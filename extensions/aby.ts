/**
 * aby — a learning tutor for the pi agent harness.
 *
 * The model owns the conversation: interviewing, explaining, grading. These tools
 * own the state a language model is bad at holding across a long session — mastery
 * scores, the roadmap DAG, spaced-repetition due dates, and what has already been
 * taught.
 *
 * Tools throw on invalid input rather than silently accepting it; pi surfaces the
 * error to the model, which can then correct itself (this is how a roadmap
 * containing a cycle gets fixed without a human in the loop).
 */

import { join } from "node:path";
import type {
  AgentToolResult,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  assertValidDag,
  indexById,
  renderDot,
  statusOf,
  toDot,
  toMermaid,
  topoOrder,
  writeDotSource,
  type RoadmapNode,
} from "../src/graph.ts";
import { applyGrade } from "../src/grade.ts";
import { describeAction, nextAction } from "../src/plan.ts";
import { MASTERY_THRESHOLD, initialReview } from "../src/schedule.ts";
import {
  dataDir,
  findSimilar,
  getNode,
  getProfile,
  listLessons,
  listNodes,
  listQuiz,
  listSkills,
  recordSkill,
  saveLesson,
  setGoal,
  upsertNodes,
} from "../src/store.ts";

function ok(payload: unknown): AgentToolResult<unknown> {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }], details: payload };
}

function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Compact roadmap view: enough for the model to reason about, small enough to reread. */
async function roadmapSummary(now: Date) {
  const nodes = await listNodes();
  if (nodes.length === 0) return [];
  const byId = indexById(nodes);
  return topoOrder(nodes).map((n) => ({
    id: n.id,
    title: n.title,
    status: statusOf(n, byId, now),
    mastery: Number(n.mastery.toFixed(2)),
    prereqs: n.prereqs,
    dueAt: n.review.dueAt,
  }));
}

async function fullState(now: Date) {
  const [profile, skills, nodes] = await Promise.all([
    getProfile(),
    listSkills(),
    listNodes(),
  ]);
  const action = nextAction({ profile, skills, nodes, now });
  return {
    goal: profile?.goal ?? null,
    skills,
    roadmap: await roadmapSummary(now),
    masteryThreshold: MASTERY_THRESHOLD,
    nextAction: { kind: action.kind, reason: action.reason },
    doThis: describeAction(action),
  };
}

export default function (pi: ExtensionAPI) {
  // ------------------------------------------------------------------ state

  pi.registerTool({
    name: "aby_get_profile",
    label: "Learner profile",
    description:
      "Read the learner's goal, assessed skills, roadmap with per-node status and mastery, and the single next action to take. Call this at the start of a tutoring session and whenever you need to know where things stand.",
    promptSnippet:
      "Read the learner's goal, skills, roadmap status and the next action",
    promptGuidelines: [
      "Call aby_get_profile before teaching, assessing or quizzing, so you never re-teach a node the learner has already mastered.",
    ],
    parameters: Type.Object({}),
    async execute() {
      return ok(await fullState(new Date()));
    },
  });

  pi.registerTool({
    name: "aby_next_action",
    label: "Next action",
    description:
      "Ask what to do next. Returns exactly one action (set_goal, assess, build_roadmap, review, learn or done) based on the roadmap, mastery scores and review due dates. Prefer this over deciding for yourself which node to cover.",
    promptSnippet: "Get the single next tutoring action to take",
    promptGuidelines: [
      "Use aby_next_action between phases instead of picking the next topic yourself; it accounts for spaced-repetition due dates you cannot track reliably.",
    ],
    parameters: Type.Object({}),
    async execute() {
      const now = new Date();
      const [profile, skills, nodes] = await Promise.all([
        getProfile(),
        listSkills(),
        listNodes(),
      ]);
      const action = nextAction({ profile, skills, nodes, now });
      return ok({
        kind: action.kind,
        reason: action.reason,
        doThis: describeAction(action),
        node:
          action.kind === "review" || action.kind === "learn"
            ? {
                id: action.node.id,
                title: action.node.title,
                summary: action.node.summary,
                mastery: Number(action.node.mastery.toFixed(2)),
              }
            : null,
      });
    },
  });

  pi.registerTool({
    name: "aby_set_goal",
    label: "Set goal",
    description:
      "Record what the learner wants to be able to do. Phrase it as a capability ('write a toy database in Rust'), not a subject area ('databases').",
    promptSnippet: "Record the learner's target capability",
    parameters: Type.Object({
      goal: Type.String({
        minLength: 3,
        description: "The capability the learner is working toward.",
      }),
    }),
    async execute(_id, params) {
      const profile = await setGoal(params.goal.trim(), new Date());
      return ok({ saved: profile });
    },
  });

  // ------------------------------------------------------------- assessment

  pi.registerTool({
    name: "aby_record_assessment",
    label: "Record assessment",
    description:
      "Record an assessed skill level for one topic, based on evidence from the learner's answers. Call once per topic you probed. Re-recording the same topic overwrites the previous entry.",
    promptSnippet: "Record an assessed skill level for one topic",
    promptGuidelines: [
      "Call aby_record_assessment only from evidence the learner actually gave you — a wrong answer or a hesitation is evidence; an unprobed guess is not.",
    ],
    parameters: Type.Object({
      topic: Type.String({ minLength: 1, description: "Topic assessed." }),
      level: Type.Integer({
        minimum: 0,
        maximum: 5,
        description:
          "0 = no exposure, 1 = heard of it, 2 = can follow along, 3 = can use with docs, 4 = fluent, 5 = can teach it.",
      }),
      confidence: Type.Number({
        minimum: 0,
        maximum: 1,
        description: "How confident you are in this rating, 0..1.",
      }),
      evidence: Type.String({
        minLength: 1,
        description:
          "What the learner said or did that justifies this level. Quote them where possible.",
      }),
    }),
    async execute(_id, params) {
      await recordSkill({
        topic: params.topic.trim(),
        level: params.level,
        confidence: params.confidence,
        evidence: params.evidence,
        assessedAt: new Date().toISOString(),
      });
      return ok({ recorded: params.topic, skills: await listSkills() });
    },
  });

  // ---------------------------------------------------------------- roadmap

  pi.registerTool({
    name: "aby_upsert_roadmap",
    label: "Upsert roadmap",
    description:
      "Create or update the roadmap as a directed acyclic graph from the learner's current level to their goal. Send the whole roadmap each time. Existing mastery and review state is preserved for nodes whose id you reuse. Rejects cycles, self-references, duplicate ids and prerequisites that name unknown nodes.",
    promptSnippet: "Write the roadmap DAG of nodes and prerequisite edges",
    promptGuidelines: [
      "When calling aby_upsert_roadmap, reuse existing node ids for topics already on the roadmap so the learner's mastery is not reset.",
      "Keep aby_upsert_roadmap nodes small enough to teach in one sitting, and express ordering only through prereqs.",
    ],
    parameters: Type.Object({
      nodes: Type.Array(
        Type.Object({
          id: Type.String({
            minLength: 1,
            description: "Stable slug, e.g. 'btree-splits'.",
          }),
          title: Type.String({ minLength: 1 }),
          summary: Type.String({
            description: "One or two sentences on what mastering this means.",
          }),
          prereqs: Type.Array(Type.String(), {
            description: "ids of nodes that must be mastered first.",
          }),
        }),
        { minItems: 1 },
      ),
    }),
    async execute(_id, params) {
      const now = new Date();
      const existing = new Map((await listNodes()).map((n) => [n.id, n]));

      // Validate against the *merged* graph so we reject a cycle before writing.
      const candidate: RoadmapNode[] = params.nodes.map((n) => ({
        id: n.id,
        title: n.title,
        summary: n.summary,
        prereqs: n.prereqs,
        mastery: existing.get(n.id)?.mastery ?? 0,
        review: existing.get(n.id)?.review ?? initialReview(),
      }));
      assertValidDag(candidate);

      const saved = await upsertNodes(
        params.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          summary: n.summary,
          prereqs: n.prereqs,
        })),
        now,
      );

      return ok({
        saved: saved.length,
        roadmap: await roadmapSummary(now),
        note: "Call aby_render_roadmap to produce the graph image.",
      });
    },
  });

  pi.registerTool({
    name: "aby_render_roadmap",
    label: "Render roadmap",
    description:
      "Render the roadmap to an image file with graphviz and return a Mermaid version for inline display. Nodes are coloured by status: mastered, due for review, available, or locked.",
    promptSnippet: "Render the roadmap graph to a file",
    parameters: Type.Object({
      format: Type.Optional(
        Type.Union([Type.Literal("svg"), Type.Literal("png")], {
          description: "Output image format. Defaults to svg.",
        }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const now = new Date();
      const nodes = await listNodes();
      if (nodes.length === 0) {
        throw new Error(
          "no roadmap to render yet — call aby_upsert_roadmap first",
        );
      }

      const format = params.format ?? "svg";
      const outDir = join(ctx.cwd, ".aby");
      const imagePath = join(outDir, `roadmap.${format}`);
      const dotPath = join(outDir, "roadmap.dot");

      const dot = toDot(nodes, now);
      await writeDotSource(dot, dotPath);
      await renderDot(dot, imagePath);

      return ok({
        image: imagePath,
        dot: dotPath,
        mermaid: toMermaid(nodes, now),
      });
    },
  });

  // ---------------------------------------------------------------- lessons

  pi.registerTool({
    name: "aby_save_lesson",
    label: "Save lesson",
    description:
      "Persist a teaching resource you just wrote, against the roadmap node it covers. Saved lessons are searchable later, so the tutor can build on them instead of repeating them.",
    promptSnippet: "Persist a lesson against a roadmap node",
    promptGuidelines: [
      "Call aby_save_lesson immediately after teaching a node, passing the full lesson text you showed the learner.",
    ],
    parameters: Type.Object({
      nodeId: Type.String({ minLength: 1 }),
      title: Type.String({ minLength: 1 }),
      markdown: Type.String({
        minLength: 1,
        description: "The full teaching resource, in Markdown.",
      }),
    }),
    async execute(_id, params) {
      const node = await getNode(params.nodeId);
      if (!node) {
        const known = (await listNodes()).map((n) => n.id);
        throw new Error(
          `unknown node id "${params.nodeId}". Known ids: ${known.join(", ") || "(none)"}`,
        );
      }
      const lessonId = id();
      await saveLesson({
        id: lessonId,
        nodeId: params.nodeId,
        title: params.title,
        markdown: params.markdown,
        createdAt: new Date().toISOString(),
      });
      return ok({ saved: lessonId, nodeId: params.nodeId });
    },
  });

  pi.registerTool({
    name: "aby_find_similar",
    label: "Find similar",
    description:
      "Semantic search over previously saved lessons, past quiz questions and roadmap nodes. Use it before teaching or writing a question to avoid repeating yourself.",
    promptSnippet:
      "Search past lessons, questions and nodes by meaning before writing new ones",
    promptGuidelines: [
      "Call aby_find_similar before writing a quiz question, and skip anything that closely matches a question already asked.",
    ],
    parameters: Type.Object({
      query: Type.String({ minLength: 1 }),
      kinds: Type.Optional(
        Type.Array(
          Type.Union([
            Type.Literal("lesson"),
            Type.Literal("quiz"),
            Type.Literal("node"),
          ]),
          { description: "Defaults to all three." },
        ),
      ),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
    }),
    async execute(_id, params) {
      const kinds = params.kinds ?? ["lesson", "quiz", "node"];
      const hits = await findSimilar(params.query, kinds, params.limit ?? 5);
      return ok({ query: params.query, hits });
    },
  });

  // ------------------------------------------------------------------- quiz

  pi.registerTool({
    name: "aby_record_quiz",
    label: "Record quiz result",
    description:
      "Record one graded question and update the node's mastery and review schedule. Score is 0..1: 1 fully correct, around 0.5 partially correct, 0 wrong. Below 0.6 counts as a lapse and the node returns tomorrow.",
    promptSnippet: "Record a graded answer and reschedule the node",
    promptGuidelines: [
      "Call aby_record_quiz for every question you grade, including ones the learner got right — the schedule only advances when successes are recorded.",
      "Grade aby_record_quiz honestly against the answer key; inflating scores pushes the next review too far out.",
    ],
    parameters: Type.Object({
      nodeId: Type.String({ minLength: 1 }),
      question: Type.String({ minLength: 1 }),
      answerKey: Type.String({
        minLength: 1,
        description: "What a correct answer needed to contain.",
      }),
      response: Type.String({ description: "What the learner actually said." }),
      score: Type.Number({ minimum: 0, maximum: 1 }),
    }),
    async execute(_id, params) {
      const now = new Date();
      const result = await applyGrade(params, now, id);

      const action = nextAction({
        profile: await getProfile(),
        skills: await listSkills(),
        nodes: await listNodes(),
        now,
      });

      return ok({
        ...result,
        nextAction: { kind: action.kind, reason: action.reason },
        doThis: describeAction(action),
      });
    },
  });

  // --------------------------------------------------------------- commands

  pi.registerCommand("assess", {
    description: "Find my current skill level (optionally: /assess <topic>)",
    handler: async (args) => {
      const scope = args.trim();
      await pi.sendUserMessage(
        `Assess my current level${scope ? ` in: ${scope}` : ""}.\n\n` +
          `Follow the tutor skill: call aby_get_profile first, then interview me with ` +
          `progressively harder questions, one at a time, and wait for my answer before ` +
          `the next. Do not lecture. When a topic is settled, call aby_record_assessment ` +
          `for it. Stop when you can place me on each topic and say what you concluded.`,
      );
    },
  });

  pi.registerCommand("roadmap", {
    description: "Build or show the roadmap graph to my goal",
    handler: async () => {
      await pi.sendUserMessage(
        `Show me the roadmap. Call aby_get_profile, then: if no roadmap exists, propose one ` +
          `as a DAG from my assessed level to my goal and call aby_upsert_roadmap. ` +
          `Either way finish by calling aby_render_roadmap and telling me which node is next and why.`,
      );
    },
  });

  pi.registerCommand("learn", {
    description: "Teach me the next thing (optionally: /learn <node id>)",
    handler: async (args) => {
      const target = args.trim();
      await pi.sendUserMessage(
        target
          ? `Teach me the roadmap node "${target}".`
          : `Teach me whatever comes next. Call aby_next_action to decide.`,
      );
    },
  });

  pi.registerCommand("quiz", {
    description: "Test me on what I should know by now",
    handler: async (args) => {
      const target = args.trim();
      await pi.sendUserMessage(
        `Quiz me${target ? ` on "${target}"` : ""}. Ask one question at a time and wait for ` +
          `my answer before the next. Check aby_find_similar first so you don't repeat a ` +
          `question. After grading each answer, call aby_record_quiz. Tell me what I got ` +
          `wrong and why before moving on.`,
      );
    },
  });

  /**
   * Deterministic status report. Deliberately does not call the model — it reads
   * stored state and prints it, so it stays correct and free.
   */
  pi.registerCommand("progress", {
    description: "Show goal, mastery and what's due (no model call)",
    handler: async (_args, ctx) => {
      const now = new Date();
      const [profile, skills, nodes, lessons, quiz] = await Promise.all([
        getProfile(),
        listSkills(),
        listNodes(),
        listLessons(),
        listQuiz(),
      ]);

      if (!profile) {
        ctx.ui.notify(
          "No goal set yet. Run /assess to get started.",
          "warning",
        );
        return;
      }

      const byId = indexById(nodes);
      const counts = { mastered: 0, due: 0, available: 0, locked: 0 };
      for (const n of nodes) counts[statusOf(n, byId, now)] += 1;

      const action = nextAction({ profile, skills, nodes, now });
      const lines = [
        `Goal: ${profile.goal}`,
        `Roadmap: ${nodes.length} nodes — ${counts.mastered} mastered, ${counts.due} due, ${counts.available} available, ${counts.locked} locked`,
        `Assessed topics: ${skills.length} · lessons written: ${lessons.length} · questions answered: ${quiz.length}`,
        `Next: ${action.reason}`,
        "",
        ...topoOrder(nodes).map((n) => {
          const st = statusOf(n, byId, now);
          const mark =
            st === "mastered"
              ? "✓"
              : st === "due"
                ? "↻"
                : st === "available"
                  ? "•"
                  : "🔒";
          const pct = String(Math.round(n.mastery * 100)).padStart(3);
          return `  ${mark} ${pct}%  ${n.title}  (${n.id})`;
        }),
        "",
        `Data: ${dataDir()}`,
      ];

      ctx.ui.notify(
        `${counts.mastered}/${nodes.length} mastered · ${counts.due} due for review`,
        "info",
      );
      await pi.sendMessage(
        {
          customType: "aby-progress",
          content: lines.join("\n"),
          display: true,
        },
        { deliverAs: "nextTurn" },
      );
    },
  });
}

/**
 * What the tutor should do next.
 *
 * This is a pure function over stored state, not a model judgement. The agent asks
 * for the next action and gets a single answer, so a long session can't drift into
 * re-teaching a mastered node or skipping a review that has come due.
 */

import {
  indexById,
  statusOf,
  topoOrder,
  type RoadmapNode,
} from "./graph.ts";
import type { Profile, SkillRow } from "./store.ts";

export type NextAction =
  | { kind: "set_goal"; reason: string }
  | { kind: "assess"; reason: string }
  | { kind: "build_roadmap"; reason: string }
  | { kind: "review"; node: RoadmapNode; reason: string }
  | { kind: "learn"; node: RoadmapNode; reason: string }
  | { kind: "done"; reason: string };

export type PlanInput = {
  profile: Profile | null;
  skills: SkillRow[];
  nodes: RoadmapNode[];
  now: Date;
};

export function nextAction(input: PlanInput): NextAction {
  const { profile, skills, nodes, now } = input;

  if (!profile || profile.goal.trim().length === 0) {
    return {
      kind: "set_goal",
      reason: "No learning goal recorded yet.",
    };
  }

  if (skills.length === 0) {
    return {
      kind: "assess",
      reason: "No skills assessed yet, so the starting point is unknown.",
    };
  }

  if (nodes.length === 0) {
    return {
      kind: "build_roadmap",
      reason: `Goal and skill levels are known, but no roadmap exists yet.`,
    };
  }

  const byId = indexById(nodes);
  const ordered = topoOrder(nodes);

  // Reviews outrank new material: retention is the point of the exercise, and a
  // lapsed prerequisite makes everything downstream shakier.
  const due = ordered
    .filter((n) => statusOf(n, byId, now) === "due")
    .sort((a, b) => (a.review.dueAt ?? "").localeCompare(b.review.dueAt ?? ""));
  const first = due[0];
  if (first) {
    return {
      kind: "review",
      node: first,
      reason: `"${first.title}" is due for review (was due ${first.review.dueAt}).`,
    };
  }

  const available = ordered.filter(
    (n) => statusOf(n, byId, now) === "available",
  );
  const next = available[0];
  if (next) {
    return {
      kind: "learn",
      node: next,
      reason: `"${next.title}" is the earliest node whose prerequisites are all mastered.`,
    };
  }

  const unmastered = ordered.filter(
    (n) => statusOf(n, byId, now) === "locked",
  );
  if (unmastered.length > 0) {
    // Only reachable if prerequisites point outside the graph; assertValidDag
    // rejects that on write, so treat it as a data problem rather than guessing.
    const stuck = unmastered[0];
    return {
      kind: "build_roadmap",
      reason:
        `Every remaining node is locked (e.g. "${stuck?.title}"), which means the ` +
        `roadmap's prerequisites are unsatisfiable. It needs rebuilding.`,
    };
  }

  return {
    kind: "done",
    reason: `Every node on the roadmap toward "${profile.goal}" is mastered and nothing is due.`,
  };
}

/** One-line summary used in tool output and the /progress command. */
export function describeAction(action: NextAction): string {
  switch (action.kind) {
    case "set_goal":
      return "Ask the learner what they want to be able to do, then call aby_set_goal.";
    case "assess":
      return "Run an adaptive assessment interview, then call aby_record_assessment per topic.";
    case "build_roadmap":
      return "Propose a roadmap DAG and call aby_upsert_roadmap.";
    case "review":
      return `Review "${action.node.title}" (id ${action.node.id}) with a question, then call aby_record_quiz.`;
    case "learn":
      return `Teach "${action.node.title}" (id ${action.node.id}), call aby_save_lesson, then quiz it.`;
    case "done":
      return "Nothing is due. Offer to extend the goal or go deeper on a node.";
  }
}

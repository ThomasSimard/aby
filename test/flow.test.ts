/**
 * The full tutoring loop end to end, with the model's judgement calls stubbed out
 * as fixed inputs: set a goal, assess, build a roadmap, teach, quiz, lapse, review.
 *
 * This is the LLM-free half of the manual verification: it proves the state machine
 * behaves, leaving only "does the model use these tools well" to a live session.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { renderDot, toDot } from "../src/graph.ts";
import { nextAction } from "../src/plan.ts";

let dir: string;
let store: typeof import("../src/store.ts");
let grade: typeof import("../src/grade.ts");

let counter = 0;
const newId = () => `id-${++counter}`;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "aby-flow-"));
  process.env.ABY_DATA_DIR = dir;
  store = await import("../src/store.ts");
  grade = await import("../src/grade.ts");
  store.resetConnection();
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function currentAction(now: Date) {
  return nextAction({
    profile: await store.getProfile(),
    skills: await store.listSkills(),
    nodes: await store.listNodes(),
    now,
  });
}

const DAY0 = new Date("2026-05-01T09:00:00.000Z");

test("a full session: goal -> assess -> roadmap -> teach -> quiz -> review", async () => {
  // 1. Cold start: the tutor must ask for a goal before anything else.
  assert.equal((await currentAction(DAY0)).kind, "set_goal");

  await store.setGoal("write a toy database in Rust", DAY0);
  assert.equal((await currentAction(DAY0)).kind, "assess");

  // 2. Assessment interview outcome.
  await store.recordSkill({
    topic: "rust ownership",
    level: 4,
    confidence: 0.9,
    evidence: "explained why the second borrow fails",
    assessedAt: DAY0.toISOString(),
  });
  assert.equal((await currentAction(DAY0)).kind, "build_roadmap");

  // 3. Roadmap: pages -> btree -> wal.
  await store.upsertNodes(
    [
      { id: "pages", title: "Slotted pages", summary: "record layout", prereqs: [] },
      { id: "btree", title: "B-tree index", summary: "search and split", prereqs: ["pages"] },
      { id: "wal", title: "Write-ahead log", summary: "durability", prereqs: ["btree"] },
    ],
    DAY0,
  );

  const afterRoadmap = await currentAction(DAY0);
  assert.equal(afterRoadmap.kind, "learn");
  assert.equal(
    afterRoadmap.kind === "learn" ? afterRoadmap.node.id : "",
    "pages",
    "the only node with no prerequisites comes first",
  );

  // 4. Teach it.
  await store.saveLesson({
    id: newId(),
    nodeId: "pages",
    title: "Slotted pages",
    markdown: "A slotted page stores a directory of offsets at the front...",
    createdAt: DAY0.toISOString(),
  });

  // 5. Quiz it correctly until mastery crosses the threshold. With an EMA of
  //    0.4 that takes four successful recalls (0.4, 0.64, 0.784, 0.87) — one
  //    right answer is deliberately not enough to call something learned.
  let day = DAY0;
  for (let i = 0; i < 4; i++) {
    const result = await grade.applyGrade(
      {
        nodeId: "pages",
        question: `Where does a slotted page keep its offsets? (${i})`,
        answerKey: "in a directory at the start of the page",
        response: "in a directory at the start of the page",
        score: 1,
      },
      day,
      newId,
    );
    assert.equal(result.lapsed, false);
    day = new Date(day.getTime() + result.intervalDays * 86_400_000);
  }

  const pages = await store.getNode("pages");
  assert.ok(
    (pages?.mastery ?? 0) >= 0.8,
    `expected pages to be mastered, got ${pages?.mastery}`,
  );

  // 6. With `pages` mastered, `btree` unlocks and `wal` stays locked behind it.
  const afterMastery = await currentAction(DAY0);
  assert.equal(afterMastery.kind, "learn");
  assert.equal(afterMastery.kind === "learn" ? afterMastery.node.id : "", "btree");

  // 7. A wrong answer on a mastered node is a lapse: mastery drops and it is
  //    scheduled for tomorrow.
  const lapse = await grade.applyGrade(
    {
      nodeId: "pages",
      question: "What happens to offsets when a record is deleted?",
      answerKey: "the slot is tombstoned and the directory entry is freed",
      response: "no idea",
      score: 0,
    },
    DAY0,
    newId,
  );
  assert.equal(lapse.lapsed, true);
  assert.ok(lapse.masteryAfter < lapse.masteryBefore);
  assert.equal(lapse.intervalDays, 1);

  // 8. The lapse pulled mastery back under the threshold, so the node returns to
  //    being *taught* rather than lightly reviewed — and it still outranks the new
  //    material behind it, which is now locked again.
  const nextDay = new Date(DAY0.getTime() + 2 * 86_400_000);
  const afterLapse = await currentAction(nextDay);
  assert.equal(afterLapse.kind, "learn");
  assert.equal(
    afterLapse.kind === "learn" ? afterLapse.node.id : "",
    "pages",
    "a forgotten prerequisite is revisited before its dependents",
  );
});

test("a mastered node that comes due is scheduled for review, not re-taught", async () => {
  // Separate node so the lapsed `pages` above doesn't interfere.
  await store.upsertNodes(
    [{ id: "solo", title: "Checksums", summary: "page integrity", prereqs: [] }],
    DAY0,
  );

  let day = DAY0;
  for (let i = 0; i < 4; i++) {
    const r = await grade.applyGrade(
      {
        nodeId: "solo",
        question: `What does the checksum protect against? (${i})`,
        answerKey: "torn writes and bit rot",
        response: "torn writes and bit rot",
        score: 1,
      },
      day,
      newId,
    );
    day = new Date(day.getTime() + r.intervalDays * 86_400_000);
  }

  const solo = await store.getNode("solo");
  assert.ok((solo?.mastery ?? 0) >= 0.8, "solo should be mastered");
  assert.ok(solo?.review.dueAt, "solo should be scheduled");

  // Before it comes due, the tutor works on something else.
  const dueAt = new Date(Date.parse(solo?.review.dueAt ?? ""));
  const before = new Date(dueAt.getTime() - 86_400_000);
  assert.notEqual(
    (await currentAction(before)).kind,
    "review",
    "nothing is due yet",
  );

  // Once due, the review pre-empts teaching new material.
  const after = new Date(dueAt.getTime() + 60_000);
  const action = await currentAction(after);
  assert.equal(action.kind, "review");
  assert.equal(action.kind === "review" ? action.node.id : "", "solo");
});

test("the roadmap renders with per-node status after a real session", async () => {
  const nodes = await store.listNodes();
  const out = join(dir, "roadmap.svg");
  await renderDot(toDot(nodes, DAY0), out);

  const svg = await readFile(out, "utf8");
  assert.match(svg, /<svg/);
  assert.match(svg, /Slotted pages/);
  // graphviz escapes hyphens in labels (B&#45;tree), so match on the node id,
  // which it emits verbatim as a <title>.
  assert.match(svg, /<title>btree<\/title>/);
  assert.match(svg, /<title>pages&#45;&gt;btree<\/title>/, "edge is drawn");
});

test("quiz history accumulates per node", async () => {
  const history = await store.listQuiz("pages");
  assert.equal(
    history.length,
    5,
    `4 correct answers plus the lapse; got ${JSON.stringify(
      history.map((h) => ({ id: h.id, score: h.score, at: h.askedAt })),
    )}`,
  );
  // askedAt ties are possible (the lapse is graded at DAY0, same as the first
  // correct answer), so assert on the set of scores rather than ordering.
  assert.deepEqual(
    history.map((h) => h.score).sort(),
    [0, 1, 1, 1, 1],
  );
});

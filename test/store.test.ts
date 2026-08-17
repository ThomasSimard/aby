/**
 * Integration test: real LanceDB on a temp directory, real local embeddings.
 * Slower than the pure tests, but it's the only thing that proves the Arrow
 * schemas and merge-insert upserts actually round-trip.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

let dir: string;
let store: typeof import("../src/store.ts");

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "aby-test-"));
  process.env.ABY_DATA_DIR = dir;
  store = await import("../src/store.ts");
  store.resetConnection();
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

const NOW = new Date("2026-03-01T00:00:00.000Z");

test("an empty database reads as empty rather than throwing", async () => {
  assert.equal(await store.getProfile(), null);
  assert.deepEqual(await store.listSkills(), []);
  assert.deepEqual(await store.listNodes(), []);
});

test("goal round-trips and preserves createdAt on update", async () => {
  const first = await store.setGoal("write a toy database in Rust", NOW);
  assert.equal(first.goal, "write a toy database in Rust");

  const later = new Date("2026-03-05T00:00:00.000Z");
  const second = await store.setGoal("write a toy database in Zig", later);
  assert.equal(second.goal, "write a toy database in Zig");
  assert.equal(second.createdAt, first.createdAt, "createdAt must be stable");
  assert.equal(second.updatedAt, later.toISOString());

  const read = await store.getProfile();
  assert.equal(read?.goal, "write a toy database in Zig");
});

test("skills upsert by topic instead of duplicating", async () => {
  await store.recordSkill({
    topic: "borrow checker",
    level: 2,
    confidence: 0.5,
    evidence: "hesitant on lifetimes",
    assessedAt: NOW.toISOString(),
  });
  await store.recordSkill({
    topic: "borrow checker",
    level: 4,
    confidence: 0.9,
    evidence: "explained variance correctly",
    assessedAt: NOW.toISOString(),
  });

  const skills = await store.listSkills();
  const rows = skills.filter((s) => s.topic === "borrow checker");
  assert.equal(rows.length, 1, "re-assessing a topic must not duplicate it");
  assert.equal(rows[0]?.level, 4);
});

test("upsertNodes preserves mastery and review state on re-proposal", async () => {
  await store.upsertNodes(
    [
      { id: "pages", title: "Page layout", summary: "slotted pages", prereqs: [] },
      {
        id: "btree",
        title: "B-tree index",
        summary: "search + split",
        prereqs: ["pages"],
      },
    ],
    NOW,
  );

  const progressed = await store.updateNodeProgress(
    "pages",
    0.85,
    { reps: 3, ease: 2.6, intervalDays: 16, dueAt: "2026-04-01T00:00:00.000Z" },
    NOW,
  );
  assert.equal(progressed?.mastery, 0.85);

  // The model re-proposes the roadmap with an edited summary.
  await store.upsertNodes(
    [
      {
        id: "pages",
        title: "Page layout",
        summary: "slotted pages, revised",
        prereqs: [],
      },
      {
        id: "btree",
        title: "B-tree index",
        summary: "search + split",
        prereqs: ["pages"],
      },
      { id: "wal", title: "Write-ahead log", summary: "durability", prereqs: ["pages"] },
    ],
    NOW,
  );

  const nodes = await store.listNodes();
  assert.equal(nodes.length, 3, "should upsert, not append duplicates");

  const pages = nodes.find((n) => n.id === "pages");
  assert.equal(pages?.summary, "slotted pages, revised", "content updates");
  assert.equal(pages?.mastery, 0.85, "earned mastery must survive re-proposal");
  assert.equal(pages?.review.reps, 3, "review state must survive re-proposal");
  assert.equal(pages?.review.dueAt, "2026-04-01T00:00:00.000Z");

  const btree = nodes.find((n) => n.id === "btree");
  assert.deepEqual(btree?.prereqs, ["pages"], "prereqs round-trip through JSON");

  const wal = nodes.find((n) => n.id === "wal");
  assert.equal(wal?.mastery, 0, "a brand new node starts unmastered");
  assert.equal(wal?.review.dueAt, null, "unscheduled reads back as null");
});

test("lessons and quiz history round-trip and filter by node", async () => {
  await store.saveLesson({
    id: "lesson-1",
    nodeId: "btree",
    title: "How B-tree splits work",
    markdown: "When a node overflows, split at the median key...",
    createdAt: NOW.toISOString(),
  });
  await store.saveLesson({
    id: "lesson-2",
    nodeId: "pages",
    title: "Slotted page layout",
    markdown: "A slotted page keeps a directory of offsets...",
    createdAt: NOW.toISOString(),
  });

  assert.equal((await store.listLessons()).length, 2);
  const forBtree = await store.listLessons("btree");
  assert.equal(forBtree.length, 1);
  assert.equal(forBtree[0]?.id, "lesson-1");

  await store.recordQuiz({
    id: "q1",
    nodeId: "btree",
    question: "What happens when a B-tree node overflows?",
    answerKey: "it splits at the median and promotes the separator",
    response: "it splits",
    score: 0.7,
    askedAt: NOW.toISOString(),
  });

  const quiz = await store.listQuiz("btree");
  assert.equal(quiz.length, 1);
  assert.equal(quiz[0]?.score, 0.7);
});

test("findSimilar discriminates between stored lessons", async () => {
  const split = await store.findSimilar(
    "how does a tree node divide when it gets too full",
    ["lesson"],
    3,
  );
  assert.ok(split.length > 0, "expected at least one hit");
  assert.equal(split[0]?.id, "lesson-1");

  const layout = await store.findSimilar(
    "where are record offsets kept inside a page",
    ["lesson"],
    3,
  );
  assert.equal(layout[0]?.id, "lesson-2");

  // Ranking must be nearest-first; callers rely on hits[0] being the best match.
  const distances = split.map((h) => h.distance);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});

test("findSimilar can search across kinds at once", async () => {
  const hits = await store.findSimilar(
    "B-tree overflow",
    ["lesson", "quiz", "node"],
    5,
  );
  const kinds = new Set(hits.map((h) => h.kind));
  assert.ok(kinds.size > 1, `expected multiple kinds, got ${[...kinds]}`);
});

test("sqlString escapes embedded quotes", () => {
  assert.equal(store.sqlString("o'brien"), "'o''brien'");
});

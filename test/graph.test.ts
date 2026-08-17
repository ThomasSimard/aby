import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertValidDag,
  findCycle,
  indexById,
  missingPrereqs,
  renderDot,
  statusOf,
  toDot,
  toMermaid,
  topoOrder,
  type RoadmapNode,
} from "../src/graph.ts";
import { initialReview } from "../src/schedule.ts";

const NOW = new Date("2026-01-10T00:00:00.000Z");

function node(
  id: string,
  prereqs: string[] = [],
  mastery = 0,
  dueAt: string | null = null,
): RoadmapNode {
  return {
    id,
    title: `Topic ${id}`,
    summary: `About ${id}`,
    prereqs,
    mastery,
    review: { ...initialReview(), dueAt },
  };
}

test("findCycle returns null for a valid DAG", () => {
  const nodes = [node("a"), node("b", ["a"]), node("c", ["a", "b"])];
  assert.equal(findCycle(nodes), null);
});

test("findCycle detects a cycle", () => {
  const nodes = [node("a", ["c"]), node("b", ["a"]), node("c", ["b"])];
  const cycle = findCycle(nodes);
  assert.ok(cycle, "expected a cycle to be reported");
  // the reported path closes on itself and names only real participants
  assert.equal(cycle.at(0), cycle.at(-1));
  assert.deepEqual(new Set(cycle), new Set(["a", "b", "c"]));
  assert.equal(cycle.length, 4);
});

test("assertValidDag rejects cycles, self-loops, dupes and dangling prereqs", () => {
  assert.throws(
    () => assertValidDag([node("a", ["b"]), node("b", ["a"])]),
    /cycle/,
  );
  assert.throws(() => assertValidDag([node("a", ["a"])]), /itself/);
  assert.throws(() => assertValidDag([node("a"), node("a")]), /duplicate/);
  assert.throws(
    () => assertValidDag([node("a", ["ghost"])]),
    /unknown nodes/,
  );
});

test("assertValidDag accepts a diamond", () => {
  const nodes = [
    node("a"),
    node("b", ["a"]),
    node("c", ["a"]),
    node("d", ["b", "c"]),
  ];
  assert.doesNotThrow(() => assertValidDag(nodes));
});

test("missingPrereqs names the offending node and edge", () => {
  const result = missingPrereqs([node("a", ["ghost", "b"]), node("b")]);
  assert.deepEqual(result, [{ id: "a", missing: ["ghost"] }]);
});

test("topoOrder puts prerequisites before dependents", () => {
  const nodes = [
    node("d", ["b", "c"]),
    node("b", ["a"]),
    node("c", ["a"]),
    node("a"),
  ];
  const order = topoOrder(nodes).map((n) => n.id);
  assert.equal(order.length, 4);
  assert.ok(order.indexOf("a") < order.indexOf("b"));
  assert.ok(order.indexOf("a") < order.indexOf("c"));
  assert.ok(order.indexOf("b") < order.indexOf("d"));
  assert.ok(order.indexOf("c") < order.indexOf("d"));
});

test("topoOrder is stable across input orderings", () => {
  const a = topoOrder([node("b", ["a"]), node("a"), node("c", ["a"])]).map(
    (n) => n.id,
  );
  const b = topoOrder([node("c", ["a"]), node("a"), node("b", ["a"])]).map(
    (n) => n.id,
  );
  assert.deepEqual(a, b);
});

test("statusOf distinguishes locked, available, mastered and due", () => {
  const nodes = [
    node("a", [], 0.9),
    node("b", ["a"], 0),
    node("c", ["b"], 0),
    node("d", [], 0.95, "2026-01-01T00:00:00.000Z"), // mastered but overdue
  ];
  const byId = indexById(nodes);

  assert.equal(statusOf(nodes[0] as RoadmapNode, byId, NOW), "mastered");
  assert.equal(
    statusOf(nodes[1] as RoadmapNode, byId, NOW),
    "available",
    "prereq is mastered so this is unlocked",
  );
  assert.equal(
    statusOf(nodes[2] as RoadmapNode, byId, NOW),
    "locked",
    "prereq b is not mastered",
  );
  assert.equal(statusOf(nodes[3] as RoadmapNode, byId, NOW), "due");
});

test("toDot emits every node and edge and escapes quotes", () => {
  const nodes = [node("a"), node("b", ["a"])];
  const evil = { ...node("c", ["a"]), title: 'has "quotes"' };
  const dot = toDot([...nodes, evil], NOW);

  assert.match(dot, /digraph roadmap/);
  assert.match(dot, /"a" -> "b"/);
  assert.match(dot, /"a" -> "c"/);
  assert.ok(!/[^\\]"quotes"/.test(dot), "raw quotes must be escaped");
});

test("toMermaid aliases ids and keeps edges", () => {
  const mermaid = toMermaid([node("a"), node("b", ["a"])], NOW);
  assert.match(mermaid, /^graph LR/);
  assert.match(mermaid, /n0\["/);
  assert.match(mermaid, /-->/);
});

test("renderDot produces a real SVG via graphviz", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aby-dot-"));
  try {
    const out = join(dir, "roadmap.svg");
    const nodes = [node("a", [], 0.9), node("b", ["a"]), node("c", ["b"])];
    await renderDot(toDot(nodes, NOW), out);

    const svg = await readFile(out, "utf8");
    assert.match(svg, /<svg/, "expected graphviz to emit an SVG");
    assert.match(svg, /Topic a/, "node labels should survive into the output");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderDot surfaces graphviz errors instead of silently succeeding", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aby-dot-"));
  try {
    await assert.rejects(
      () => renderDot("this is not valid dot {{{", join(dir, "bad.svg")),
      /dot exited/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

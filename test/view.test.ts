import assert from "node:assert/strict";
import { test } from "node:test";
import { toMermaid, type RoadmapNode } from "../src/graph.ts";
import { initialReview } from "../src/schedule.ts";
import type { Profile, SkillRow } from "../src/store.ts";
import {
  clip,
  masteryBar,
  progressCard,
  progressRows,
  relativeDue,
  segmentsWidth,
  STATUS_MARK,
  summarize,
  widgetSegments,
} from "../src/view.ts";

const NOW = new Date("2026-02-01T00:00:00.000Z");

const PROFILE: Profile = {
  goal: "write a toy database in Rust",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SKILLS: SkillRow[] = [
  {
    topic: "rust basics",
    level: 3,
    confidence: 0.8,
    evidence: "explained borrow rules correctly",
    assessedAt: "2026-01-02T00:00:00.000Z",
  },
];

function node(
  id: string,
  prereqs: string[] = [],
  mastery = 0,
  dueAt: string | null = null,
): RoadmapNode {
  return {
    id,
    title: `Topic ${id}`,
    summary: `What ${id} is about`,
    prereqs,
    mastery,
    review: { ...initialReview(), dueAt },
  };
}

const NODES = [
  node("a", [], 0.95),
  node("b", [], 0.9, "2026-01-20T00:00:00.000Z"), // overdue
  node("c", ["a"], 0.2),
  node("d", ["c"]),
];

function card(width: number, expanded: boolean) {
  const summary = summarize({
    profile: PROFILE,
    skills: SKILLS,
    nodes: NODES,
    now: NOW,
  });
  return progressCard(
    {
      summary,
      rows: progressRows(NODES, NOW),
      totals: { skills: 1, lessons: 2, quiz: 9 },
      dataDir: "/home/someone/.local/share/aby",
      now: NOW,
    },
    width,
    expanded,
  );
}

test("a mastery bar always occupies the cells it was given", () => {
  for (const cells of [0, 1, 4, 10, 14]) {
    for (const mastery of [-1, 0, 0.37, 1, 2]) {
      assert.equal(
        Array.from(masteryBar(mastery, cells)).length,
        cells,
        `${mastery} at ${cells} cells`,
      );
    }
  }
});

test("a mastery bar fills in proportion", () => {
  assert.equal(masteryBar(0, 4), "░░░░");
  assert.equal(masteryBar(1, 4), "████");
  assert.equal(masteryBar(0.5, 4), "██░░");
});

test("clip only shortens what does not fit", () => {
  assert.equal(clip("short", 10), "short");
  assert.equal(clip("abcdefgh", 4), "abc…");
  assert.equal(clip("abc", 0), "");
});

test("due dates read in days, relative to the given clock", () => {
  assert.equal(relativeDue(null, NOW), "unscheduled");
  assert.equal(relativeDue("2026-02-01T00:00:00.000Z", NOW), "today");
  assert.equal(relativeDue("2026-02-02T00:00:00.000Z", NOW), "tomorrow");
  assert.equal(relativeDue("2026-02-04T00:00:00.000Z", NOW), "in 3d");
  assert.equal(relativeDue("2026-01-30T00:00:00.000Z", NOW), "2d overdue");
});

test("progress rows follow prerequisite order and carry status", () => {
  const rows = progressRows(NODES, NOW);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(
    rows.map((r) => r.status),
    ["mastered", "due", "available", "locked"],
  );
});

test("the summary counts every status and reports what is next", () => {
  const summary = summarize({
    profile: PROFILE,
    skills: SKILLS,
    nodes: NODES,
    now: NOW,
  });
  assert.deepEqual(summary.counts, {
    mastered: 1,
    due: 1,
    available: 1,
    locked: 1,
  });
  assert.equal(summary.total, 4);
  assert.equal(summary.progress, 0.25);
  // A due review outranks new material, so the widget points at the review.
  assert.equal(summary.nextKind, "review");
  assert.equal(summary.nextTitle, "Topic b");
});

test("the widget fits the width it is given", () => {
  for (const width of [20, 30, 40, 60, 80, 120]) {
    const summary = summarize({
      profile: PROFILE,
      skills: SKILLS,
      nodes: NODES,
      now: NOW,
    });
    for (const line of widgetSegments(summary, width)) {
      assert.ok(
        segmentsWidth(line) <= width,
        `widget line of ${segmentsWidth(line)} exceeds ${width}`,
      );
    }
  }
});

test("the progress card fits the width it is given, expanded or not", () => {
  for (const width of [30, 40, 60, 80, 120]) {
    for (const expanded of [false, true]) {
      for (const line of card(width, expanded)) {
        assert.ok(
          segmentsWidth(line) <= width,
          `card line of ${segmentsWidth(line)} exceeds ${width}`,
        );
      }
    }
  }
});

test("the expanded card adds the id, due date and summary per node", () => {
  const text = (expanded: boolean) =>
    card(80, expanded)
      .map((line) => line.map((s) => s.text).join(""))
      .join("\n");

  const collapsed = text(false);
  assert.ok(collapsed.includes(PROFILE.goal));
  assert.ok(collapsed.includes("Topic c"));
  assert.ok(!collapsed.includes("What c is about"));

  const expanded = text(true);
  assert.ok(expanded.includes("What c is about"));
  assert.ok(expanded.includes("2d overdue"));
});

test("the roadmap art and the progress card use the same status marks", () => {
  const mermaid = toMermaid(NODES, NOW);
  assert.ok(mermaid.includes(`${STATUS_MARK.mastered} Topic a`));
  assert.ok(mermaid.includes(`${STATUS_MARK.due} Topic b`));

  const marks = card(80, false)
    .flatMap((line) => line.map((s) => s.text))
    .filter((t) => Object.values(STATUS_MARK).includes(t));
  assert.deepEqual(marks, [
    STATUS_MARK.mastered,
    STATUS_MARK.due,
    STATUS_MARK.available,
    STATUS_MARK.locked,
  ]);
});

test("no status mark is double-width", () => {
  // A wide glyph (the old 🔒) knocks the mastery column out of alignment and
  // inflates the width grok-mermaid computes for a node label.
  for (const mark of Object.values(STATUS_MARK)) {
    assert.equal(Array.from(mark).length, 1, mark);
    const code = mark.codePointAt(0) ?? 0;
    assert.ok(code < 0x1f000, `${mark} is in an emoji block`);
  }
});

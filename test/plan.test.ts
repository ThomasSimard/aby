import assert from "node:assert/strict";
import { test } from "node:test";
import type { RoadmapNode } from "../src/graph.ts";
import { nextAction } from "../src/plan.ts";
import { initialReview } from "../src/schedule.ts";
import type { Profile, SkillRow } from "../src/store.ts";

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
    summary: "",
    prereqs,
    mastery,
    review: { ...initialReview(), dueAt },
  };
}

test("asks for a goal before anything else", () => {
  const a = nextAction({ profile: null, skills: [], nodes: [], now: NOW });
  assert.equal(a.kind, "set_goal");
});

test("an empty goal string still counts as no goal", () => {
  const a = nextAction({
    profile: { ...PROFILE, goal: "   " },
    skills: SKILLS,
    nodes: [],
    now: NOW,
  });
  assert.equal(a.kind, "set_goal");
});

test("assesses before building a roadmap", () => {
  const a = nextAction({
    profile: PROFILE,
    skills: [],
    nodes: [],
    now: NOW,
  });
  assert.equal(a.kind, "assess");
});

test("builds a roadmap once the goal and skills are known", () => {
  const a = nextAction({
    profile: PROFILE,
    skills: SKILLS,
    nodes: [],
    now: NOW,
  });
  assert.equal(a.kind, "build_roadmap");
});

test("teaches the earliest node whose prerequisites are mastered", () => {
  const nodes = [node("a", [], 0.9), node("b", ["a"]), node("c", ["b"])];
  const a = nextAction({ profile: PROFILE, skills: SKILLS, nodes, now: NOW });
  assert.equal(a.kind, "learn");
  assert.equal(a.kind === "learn" ? a.node.id : "", "b");
});

test("a due review outranks new material", () => {
  const nodes = [
    node("a", [], 0.9, "2026-01-15T00:00:00.000Z"), // overdue
    node("b", ["a"]), // available
  ];
  const a = nextAction({ profile: PROFILE, skills: SKILLS, nodes, now: NOW });
  assert.equal(a.kind, "review");
  assert.equal(a.kind === "review" ? a.node.id : "", "a");
});

test("the most overdue review comes first", () => {
  const nodes = [
    node("a", [], 0.9, "2026-01-20T00:00:00.000Z"),
    node("b", [], 0.9, "2026-01-05T00:00:00.000Z"),
  ];
  const a = nextAction({ profile: PROFILE, skills: SKILLS, nodes, now: NOW });
  assert.equal(a.kind === "review" ? a.node.id : "", "b");
});

test("reports done when everything is mastered and nothing is due", () => {
  const nodes = [node("a", [], 0.95), node("b", ["a"], 0.9)];
  const a = nextAction({ profile: PROFILE, skills: SKILLS, nodes, now: NOW });
  assert.equal(a.kind, "done");
});

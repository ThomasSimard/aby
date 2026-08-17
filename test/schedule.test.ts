import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_EASE,
  MIN_EASE,
  initialReview,
  isDue,
  scheduleNext,
  scoreToQuality,
  updateMastery,
} from "../src/schedule.ts";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function daysBetween(from: Date, iso: string): number {
  return Math.round((Date.parse(iso) - from.getTime()) / 86_400_000);
}

test("scoreToQuality maps 0..1 onto SM-2's 0..5", () => {
  assert.equal(scoreToQuality(0), 0);
  assert.equal(scoreToQuality(1), 5);
  assert.equal(scoreToQuality(0.6), 3);
  // out of range input is clamped rather than producing a nonsense quality
  assert.equal(scoreToQuality(-4), 0);
  assert.equal(scoreToQuality(9), 5);
});

test("successful reviews follow the 1 / 6 / interval*ease progression", () => {
  const first = scheduleNext(initialReview(), 5, NOW);
  assert.equal(first.reps, 1);
  assert.equal(first.intervalDays, 1);
  assert.equal(daysBetween(NOW, first.dueAt ?? ""), 1);

  const second = scheduleNext(first, 5, NOW);
  assert.equal(second.reps, 2);
  assert.equal(second.intervalDays, 6);

  // Canonical SM-2 updates the ease factor first, then scales the previous
  // interval by the *new* ease.
  const third = scheduleNext(second, 5, NOW);
  assert.equal(third.reps, 3);
  assert.equal(third.intervalDays, Math.round(6 * third.ease));
  assert.ok(third.intervalDays > second.intervalDays);
});

test("a lapse resets reps and brings the node back tomorrow", () => {
  const grown = scheduleNext(
    scheduleNext(scheduleNext(initialReview(), 5, NOW), 5, NOW),
    5,
    NOW,
  );
  assert.ok(grown.intervalDays > 6);

  const lapsed = scheduleNext(grown, 1, NOW);
  assert.equal(lapsed.reps, 0);
  assert.equal(lapsed.intervalDays, 1);
  assert.ok(lapsed.ease < grown.ease, "ease should drop after a lapse");
  assert.ok(lapsed.ease >= MIN_EASE, "ease must never fall below the floor");
});

test("ease never drops below the floor no matter how many lapses", () => {
  let r = initialReview();
  for (let i = 0; i < 50; i++) r = scheduleNext(r, 0, NOW);
  assert.equal(r.ease, MIN_EASE);
});

test("hard-but-passing answers reduce ease from the default", () => {
  const r = scheduleNext(initialReview(), 3, NOW);
  assert.ok(r.ease < DEFAULT_EASE);
  assert.equal(r.reps, 1);
});

test("mastery moves in both directions", () => {
  const up = updateMastery(0.5, 1);
  assert.ok(up > 0.5);
  const down = updateMastery(0.9, 0);
  assert.ok(down < 0.9, "a wrong answer must pull mastery back down");
  assert.ok(down >= 0 && up <= 1);
});

test("mastery converges toward sustained performance", () => {
  let m = 0;
  for (let i = 0; i < 25; i++) m = updateMastery(m, 1);
  assert.ok(m > 0.99);
});

test("isDue only fires once the due date has passed", () => {
  const r = scheduleNext(initialReview(), 5, NOW); // due in 1 day
  assert.equal(isDue(r, NOW), false);
  assert.equal(isDue(r, new Date("2026-01-02T00:00:01.000Z")), true);
  assert.equal(isDue(initialReview(), NOW), false, "unscheduled is never due");
});

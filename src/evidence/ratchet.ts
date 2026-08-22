/**
 * The debt, written down.
 *
 * Two closed sets and a ceiling. `test/evidence.test.ts` asserts SET EQUALITY with
 * the bindings that actually declare each kind — not a count, because a count lets
 * you retire one unsourced parameter, introduce another, and stay green.
 *
 * Set equality means both directions are visible:
 *
 *   - adding an unsourced parameter fails until you edit this file, so the debt
 *     always arrives as a diff a reviewer sees;
 *   - SOURCING one also fails, and the failure tells you to remove it here and
 *     lower the ceiling. The test's job is to make the ratchet tighten.
 *
 * `MAX_UNSOURCED` is a commitment device rather than a mechanism — set equality
 * already blocks silent growth. What the ceiling adds is a number that can only go
 * down, so drift across many small changes has somewhere to show up.
 *
 * Every entry below carries an `openQuestion` in its binding. Read together, this
 * list is aby's research backlog: `node scripts/evidence.ts` prints it as one.
 */
import type { ParamId } from "./params.ts";

/** No source. The question that would settle each is in its binding. */
export const UNSOURCED: readonly ParamId[] = [
  "assess/questions-per-topic-max",
  "assess/questions-per-topic-min",
  "grade/lapse-threshold",
  "grade/score-partial-credit",
  "mastery/crossings-to-threshold",
  "roadmap/node-count-max",
  "roadmap/node-count-min",
  "roadmap/skip-at-or-above-level",
  "schedule/mastery-threshold",
  "tutor/assessing/one-question-at-a-time-ask",
  "tutor/assessing/start-midrange-and-move-correct-and",
  "tutor/assessing/stop-when-placed-usually-36-questions",
  "tutor/assessing/the-point-is-to-find-the",
  "tutor/building-the-roadmap/820-nodes-is-usually-right-if",
  "tutor/quizzing/call-abyfindsimilar-first-and-avoid-reasking",
  "tutor/teaching/before-writing-call-abyfindsimilar-for-the",
  "tutor/teaching/lead-with-the-problem-the-concept",
  "tutor/teaching/name-the-failure-mode-the",
  "tutor/teaching/stay-in-one-sittings-worth-of",
];

/**
 * Inherited from an implementation rather than from evidence. Not the same debt as
 * `UNSOURCED` — the value has a traceable origin — but debt all the same, and each
 * one names the evidence that would retire it in its `switchWhen`.
 */
export const CONVENTIONAL: readonly ParamId[] = [
  "schedule/default-ease",
  "schedule/min-ease",
];

/**
 * Phase 0 baseline: 19 of aby's 42 learning parameters have nothing behind them.
 * Lower this whenever one is retired; the test will tell you to.
 */
export const MAX_UNSOURCED = 19;

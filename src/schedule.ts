/**
 * Spaced repetition and mastery tracking.
 *
 * This is deliberately plain arithmetic rather than something the model decides:
 * review scheduling depends on dates and counters that an LLM drifts on across a
 * long session. The model grades an answer; this file decides when you see it again.
 *
 * Pure functions only — no I/O, no clock reads. `now` is always passed in.
 */

/** SM-2 review state carried per roadmap node. */
export type Review = {
  /** Consecutive successful reviews. Reset to 0 on a lapse. */
  reps: number;
  /** SM-2 ease factor. Never drops below MIN_EASE. */
  ease: number;
  /** Days until the next review. */
  intervalDays: number;
  /** ISO timestamp when this becomes due, or null if never scheduled. */
  dueAt: string | null;
};

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

/** A node counts as mastered at or above this. */
export const MASTERY_THRESHOLD = 0.8;

/** Weight of the newest score when updating mastery. */
const MASTERY_ALPHA = 0.4;

export function initialReview(): Review {
  return { reps: 0, ease: DEFAULT_EASE, intervalDays: 0, dueAt: null };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Map a 0..1 grade onto SM-2's 0..5 quality scale.
 *
 * SM-2 treats q < 3 as a lapse, so the split lands at 0.6: anything below that
 * resets the repetition count and the item comes back tomorrow.
 */
export function scoreToQuality(score: number): number {
  return Math.round(clamp(score, 0, 1) * 5);
}

/**
 * Exponential moving average of grades. Moves both directions, so a wrong answer
 * on a previously-known node genuinely drops it back below the mastery threshold.
 */
export function updateMastery(prev: number, score: number): number {
  const s = clamp(score, 0, 1);
  const p = clamp(prev, 0, 1);
  return clamp(p * (1 - MASTERY_ALPHA) + s * MASTERY_ALPHA, 0, 1);
}

function addDays(now: Date, days: number): string {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

/** Standard SM-2 step. `quality` is 0..5; below 3 is a lapse. */
export function scheduleNext(prev: Review, quality: number, now: Date): Review {
  const q = clamp(Math.round(quality), 0, 5);

  if (q < 3) {
    // Lapse: relearn from scratch tomorrow, but keep (reduced) ease so a node
    // you repeatedly fail keeps short intervals instead of springing back to 6 days.
    const ease = Math.max(MIN_EASE, prev.ease - 0.2);
    return { reps: 0, ease, intervalDays: 1, dueAt: addDays(now, 1) };
  }

  const ease = Math.max(
    MIN_EASE,
    prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );
  const reps = prev.reps + 1;

  let intervalDays: number;
  if (reps === 1) intervalDays = 1;
  else if (reps === 2) intervalDays = 6;
  else intervalDays = Math.max(1, Math.round(prev.intervalDays * ease));

  return { reps, ease, intervalDays, dueAt: addDays(now, intervalDays) };
}

/** True when a scheduled node is due for review at `now`. */
export function isDue(review: Review, now: Date): boolean {
  if (!review.dueAt) return false;
  const t = Date.parse(review.dueAt);
  return Number.isFinite(t) && t <= now.getTime();
}

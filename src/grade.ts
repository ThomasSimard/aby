/**
 * Grading one answer: record it, move mastery, reschedule the node.
 *
 * Lives here rather than inline in the extension so the core loop can be tested
 * without a model in the way.
 */

import {
  MASTERY_THRESHOLD,
  scheduleNext,
  scoreToQuality,
  updateMastery,
} from "./schedule.ts";
import { getNode, listNodes, recordQuiz, updateNodeProgress } from "./store.ts";

export type GradeInput = {
  nodeId: string;
  question: string;
  answerKey: string;
  response: string;
  /** 0..1 */
  score: number;
};

export type GradeResult = {
  nodeId: string;
  masteryBefore: number;
  masteryAfter: number;
  mastered: boolean;
  nextReviewAt: string | null;
  intervalDays: number;
  lapsed: boolean;
};

/** A score below this is treated as a lapse by SM-2 (quality < 3). */
export const LAPSE_THRESHOLD = 0.6;

export async function applyGrade(
  input: GradeInput,
  now: Date,
  newId: () => string,
): Promise<GradeResult> {
  const node = await getNode(input.nodeId);
  if (!node) {
    const known = (await listNodes()).map((n) => n.id);
    throw new Error(
      `unknown node id "${input.nodeId}". Known ids: ${known.join(", ") || "(none)"}`,
    );
  }

  await recordQuiz({
    id: newId(),
    nodeId: input.nodeId,
    question: input.question,
    answerKey: input.answerKey,
    response: input.response,
    score: input.score,
    askedAt: now.toISOString(),
  });

  const masteryAfter = updateMastery(node.mastery, input.score);
  const review = scheduleNext(node.review, scoreToQuality(input.score), now);
  await updateNodeProgress(input.nodeId, masteryAfter, review, now);

  return {
    nodeId: input.nodeId,
    masteryBefore: Number(node.mastery.toFixed(2)),
    masteryAfter: Number(masteryAfter.toFixed(2)),
    mastered: masteryAfter >= MASTERY_THRESHOLD,
    nextReviewAt: review.dueAt,
    intervalDays: review.intervalDays,
    lapsed: input.score < LAPSE_THRESHOLD,
  };
}

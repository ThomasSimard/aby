import type { Claim } from "../types.ts";

/** Claims about what "knows it" could be made to mean. */
export const MASTERY_CLAIMS = {
  "mastery/bkt-declares-mastery-at-p-95": {
    id: "mastery/bkt-declares-mastery-at-p-95",
    statement:
      "Bayesian knowledge tracing treats a skill as mastered when the posterior probability that the learner knows it reaches 0.95, and intelligent tutors built on it stop drilling at that point.",
    implication:
      "This is the closest thing in the literature to a principled mastery cut - and it is NOT transferable to aby as it stands. 0.95 is a posterior probability under a model with explicit guess and slip parameters; aby's mastery is a moving average of graded scores. Same interval, different quantity. The comparison only becomes available if aby adopts a knowledge-tracing model.",
    sort: "empirical",
    supportedBy: [{ paper: "corbett-anderson-1995-bkt", finding: "mastery-criterion" }],
    contradictedBy: [],
    moderators: [
      "Fit to machine-gradeable procedural steps, not model-graded free-text answers.",
    ],
    strength: "moderate",
    strengthRationale:
      "The model and its criterion are well established, but the criterion is a modelling convention within BKT rather than an outcome that was optimised against retention.",
  },

  "metacognition/fluency-is-a-poor-cue-for-retention": {
    id: "metacognition/fluency-is-a-poor-cue-for-retention",
    statement:
      "How easily material comes to mind during study predicts later retention poorly, and learners systematically mistake fluency for learning.",
    implication:
      "Assessment must rest on recorded performance rather than on how confident anyone felt - the learner OR the tutor. Evidence for grading against a key and recording every result, and against treating a smooth-sounding answer as mastery.",
    sort: "empirical",
    supportedBy: [{ paper: "bjork-2013-self-regulated-learning" }],
    contradictedBy: [],
    moderators: [
      "Concerns the learner's own judgements. It says nothing about a model's confidence in an assessment it produced, and must not be cited for that.",
    ],
    strength: "strong",
  },
} as const satisfies Record<string, Claim>;

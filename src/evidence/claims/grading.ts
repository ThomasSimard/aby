import type { Claim } from "../types.ts";

/** Claims that constrain how an answer is asked for, scored and responded to. */
export const GRADING_CLAIMS = {
  "retrieval/testing-beats-restudy": {
    id: "retrieval/testing-beats-restudy",
    statement:
      "Attempting to retrieve material produces better long-term retention than re-studying it for the same amount of time.",
    implication:
      "aby's core loop is right: quiz rather than re-present, and treat a forgotten node as something to be retrieved again rather than re-explained from scratch. This is the best-evidenced thing the tool does.",
    sort: "empirical",
    supportedBy: [
      { paper: "rowland-2014-testing-effect", finding: "overall-g" },
      { paper: "adesope-2017-practice-testing", finding: "overall-g" },
      { paper: "dunlosky-2013-techniques" },
    ],
    contradictedBy: [],
    moderators: [
      "Larger for more effortful retrieval formats and for more complex material.",
      "Larger when feedback is given during practice.",
    ],
    strength: "strong",
  },

  "retrieval/feedback-strengthens-the-testing-effect": {
    id: "retrieval/feedback-strengthens-the-testing-effect",
    statement:
      "The retention advantage of retrieval practice is larger when the learner is told the correct answer afterwards than when they are not.",
    implication:
      "Explaining the error before moving on is not politeness, it is part of the mechanism. It is also currently unenforced: aby records a score but no feedback, so nothing can tell whether the rule was followed.",
    sort: "empirical",
    supportedBy: [{ paper: "rowland-2014-testing-effect" }],
    contradictedBy: [],
    moderators: [],
    strength: "moderate",
    strengthRationale:
      "Reported as a moderator of the meta-analytic effect rather than as a separately pooled contrast, and the subgroup values are not yet recorded in this corpus at source.",
  },

  "feedback/task-focused-feedback-helps-self-focused-feedback-harms": {
    id: "feedback/task-focused-feedback-helps-self-focused-feedback-harms",
    statement:
      "Feedback improves performance on average, but a substantial minority of feedback interventions make it worse, and the harm concentrates where feedback directs attention to the person rather than to the task.",
    implication:
      "Say what was wrong with the ANSWER and why. Praise and criticism aimed at the learner are the failure mode, not the softer version of the same thing. This is why aby's tone rule is worded about the answer.",
    sort: "empirical",
    supportedBy: [
      { paper: "kluger-denisi-1996-feedback", finding: "share-reducing-performance" },
      { paper: "hattie-timperley-2007-feedback" },
    ],
    contradictedBy: [],
    moderators: [
      "Largely workplace and laboratory task performance; transfer to one-to-one tutoring is assumed rather than shown.",
    ],
    strength: "moderate",
    strengthRationale:
      "The average effect and the existence of a harmful tail are both well established; the task/self moderator is a theoretical account fitted to the meta-analysis rather than an independently tested contrast.",
  },

  "difficulty/learning-rate-peaks-below-perfect-accuracy": {
    id: "difficulty/learning-rate-peaks-below-perfect-accuracy",
    statement:
      "For a broad class of gradient-descent learners on binary classification, the rate of learning is maximised at a training error rate near 16 percent rather than at zero.",
    implication:
      "Weak support for pitching questions so the learner sometimes fails - questions they always get right carry little information. It is an ANALOGY: nothing here was measured on people, and it concerns item difficulty, never a pass mark.",
    sort: "empirical",
    supportedBy: [
      { paper: "wilson-2019-eighty-five-percent", finding: "optimal-error-rate" },
    ],
    contradictedBy: [],
    moderators: [
      "Analytical and simulation result for artificial learners on binary classification.",
      "Says nothing about declarative recall, free-text answers, or human motivation.",
    ],
    strength: "weak",
    strengthRationale:
      "Not a finding about human learners at all. Recorded because the '85% rule' circulates widely as if it were one, and the corpus should show what citing it honestly looks like.",
  },
} as const satisfies Record<string, Claim>;

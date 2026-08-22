import type { Claim } from "../types.ts";

/** Claims that constrain how a lesson is written and how much aby may claim. */
export const INSTRUCTION_CLAIMS = {
  "instruction/worked-examples-help-novices-and-hinder-experts": {
    id: "instruction/worked-examples-help-novices-and-hinder-experts",
    statement:
      "Studying a fully worked example benefits learners with little prior knowledge and loses or reverses its advantage as prior knowledge grows, where solving the problem directly becomes more effective.",
    implication:
      "A worked example is the right default for a learner new to a topic and the wrong one for a learner assessed as fluent. aby knows the learner's level per topic and currently ignores it when teaching.",
    sort: "empirical",
    supportedBy: [{ paper: "kalyuga-2003-expertise-reversal" }],
    contradictedBy: [],
    moderators: [
      "The crossover point is domain-specific and is not given by the source.",
      "Prior knowledge means knowledge of the specific content, not general ability or a self-reported level.",
    ],
    strength: "strong",
  },

  "instruction/tutoring-gains-are-well-under-two-sigma": {
    id: "instruction/tutoring-gains-are-well-under-two-sigma",
    statement:
      "One-to-one tutoring, human or computerised, improves outcomes by roughly 0.8 standard deviations against no tutoring, not the two standard deviations the best-known claim reports.",
    implication:
      "Bounds what this repository may assert about itself. aby is a spaced-repetition tutor with plausible mechanisms behind it, not a two-sigma intervention.",
    sort: "empirical",
    supportedBy: [
      { paper: "vanlehn-2011-tutoring", finding: "its-vs-no-tutoring-d" },
      { paper: "vanlehn-2011-tutoring", finding: "human-vs-no-tutoring-d" },
    ],
    contradictedBy: [{ paper: "bloom-1984-two-sigma", finding: "two-sigma-d" }],
    moderators: ["Comparison is against no tutoring, not against ordinary instruction."],
    strength: "strong",
  },
} as const satisfies Record<string, Claim>;

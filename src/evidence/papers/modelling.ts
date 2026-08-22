import type { Paper } from "../types.ts";

/**
 * Models of the learner's state — what "mastered" could be made to mean.
 *
 * Both papers here are currently cited to explain why aby's numbers are NOT
 * comparable to theirs. That is the corpus doing its job.
 */
export const MODELLING = {
  "corbett-anderson-1995-bkt": {
    id: "corbett-anderson-1995-bkt",
    authors: ["Corbett, A. T.", "Anderson, J. R."],
    year: 1995,
    title: "Knowledge tracing: Modeling the acquisition of procedural knowledge",
    venue: "User Modeling and User-Adapted Interaction, 4(4), 253-278",
    design: "model-fit",
    findings: [
      {
        id: "mastery-criterion",
        quantity: "P(skill known) at which the Cognitive Tutors stop drilling a skill",
        value: 0.95,
        unit: "probability",
        locator: "abstract / the mastery criterion used in the ACT Programming Tutor",
      },
    ],
    caveats: [
      "0.95 is a POSTERIOR PROBABILITY under a two-state hidden Markov model with guess and slip parameters. aby's mastery is an exponential moving average of graded scores. The two are different quantities on the same [0,1] interval and are NOT comparable — transplanting 0.95 onto an EMA would be a category error, which is precisely why aby's threshold is bound `unsourced` rather than to this paper.",
      "Fit to procedural skills in programming and mathematics tutors with machine-gradeable steps, not to model-graded free-text answers.",
    ],
    replication: "replicated",
  },

  "wilson-2019-eighty-five-percent": {
    id: "wilson-2019-eighty-five-percent",
    authors: ["Wilson, R. C.", "Shenhav, A.", "Straccia, M.", "Cohen, J. D."],
    year: 2019,
    title: "The Eighty Five Percent Rule for optimal learning",
    venue: "Nature Communications, 10, 4646",
    doi: "10.1038/s41467-019-12552-4",
    design: "simulation",
    findings: [
      {
        id: "optimal-error-rate",
        quantity: "training error rate maximising rate of learning",
        value: 0.1587,
        unit: "ratio",
        locator: "abstract",
      },
    ],
    caveats: [
      "DERIVED ANALYTICALLY for stochastic-gradient-descent learners on binary classification tasks, with supporting simulation. It is not a measurement on human learners, and the popular '85% rule' framing routinely omits that.",
      "It concerns the DIFFICULTY OF TRAINING ITEMS, not the pass mark on a graded answer. Binding it to a lapse threshold would be a category error.",
      "Any use in aby is an analogy and must be bound `bounded` with that stated, never `reported`.",
    ],
    replication: "n/a",
  },
} as const satisfies Record<string, Paper>;

import type { Claim } from "../types.ts";

/** Claims that constrain what order things are taught in. */
export const SEQUENCING_CLAIMS = {
  "sequencing/interleaving-is-moderated-by-material-and-reverses-for-words": {
    id: "sequencing/interleaving-is-moderated-by-material-and-reverses-for-words",
    statement:
      "Interleaving different problem types helps on average, strongly for visually similar categories and modestly for mathematics, but has no reliable effect for expository text and is WORSE than blocking for word learning.",
    implication:
      "Forbids a blanket interleaving rule in aby. The material aby teaches is closest to expository and procedural, where the effect is small or absent, so teaching one node at a time stays the default until there is a reason specific to the material.",
    sort: "empirical",
    supportedBy: [
      { paper: "brunmair-2019-interleaving", finding: "overall-g" },
      { paper: "brunmair-2019-interleaving", finding: "paintings-g" },
      { paper: "brunmair-2019-interleaving", finding: "math-g" },
    ],
    contradictedBy: [{ paper: "brunmair-2019-interleaving", finding: "words-g" }],
    moderators: [
      "Material type is the dominant moderator and flips the sign for words.",
      "The overall estimate is not usable on its own.",
    ],
    strength: "contested",
    strengthRationale:
      "The meta-analysis is sound; the effect itself is genuinely conditional, and the condition that matters is the one where aby's material sits and the evidence is weakest.",
  },

  "sequencing/competence-is-a-prerequisite-closed-state-with-a-fringe": {
    id: "sequencing/competence-is-a-prerequisite-closed-state-with-a-fringe",
    statement:
      "What a learner knows can be represented as a prerequisite-closed set of items, with an outer fringe of items that are immediately learnable because their prerequisites are met.",
    implication:
      "Justifies aby's roadmap DAG and its available/locked distinction. It does NOT rank the fringe: any rule for choosing among simultaneously-available nodes is aby's own and must be bound as such.",
    sort: "empirical",
    supportedBy: [{ paper: "falmagne-1990-knowledge-spaces" }],
    contradictedBy: [],
    moderators: [],
    strength: "weak",
    strengthRationale:
      "A formal framework with a long record of applied use, not an efficacy result. It says a structure is coherent and buildable, not that teaching in that order works better.",
  },
} as const satisfies Record<string, Claim>;

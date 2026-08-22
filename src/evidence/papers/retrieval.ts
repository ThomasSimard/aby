import type { Paper } from "../types.ts";

/**
 * Retrieval practice — why aby quizzes instead of re-presenting.
 *
 * This is the best-evidenced thing aby does, and the corpus should say so as
 * plainly as it says where the evidence runs out.
 */
export const RETRIEVAL = {
  "rowland-2014-testing-effect": {
    id: "rowland-2014-testing-effect",
    authors: ["Rowland, C. A."],
    year: 2014,
    title: "The effect of testing versus restudy on retention: A meta-analytic review of the testing effect",
    venue: "Psychological Bulletin, 140(6), 1432-1463",
    doi: "10.1037/a0037559",
    design: "meta-analysis",
    findings: [
      {
        id: "overall-g",
        quantity: "retrieval practice versus restudy, final-test retention",
        value: 0.5,
        unit: "hedges-g",
        ci: [0.42, 0.58],
        n: 159,
        nBasis: "effect sizes",
        locator: "abstract",
      },
    ],
    caveats: [
      "Format moderators (recall clearly outperforming recognition) are reported but are NOT recorded here yet: the subgroup values were taken from secondary summaries during planning and have not been checked against the paper. They belong in the corpus only once read at source.",
      "The benefit is reported as larger when feedback is given during practice — which is the empirical case for aby recording feedback, and is currently unbound because aby does not record any.",
    ],
    replication: "replicated",
  },

  "adesope-2017-practice-testing": {
    id: "adesope-2017-practice-testing",
    authors: ["Adesope, O. O.", "Trevisan, D. A.", "Sundararajan, N."],
    year: 2017,
    title: "Rethinking the use of tests: A meta-analysis of practice testing",
    venue: "Review of Educational Research, 87(3), 659-701",
    design: "meta-analysis",
    findings: [
      {
        id: "overall-g",
        quantity: "practice testing versus comparison conditions",
        value: 0.61,
        unit: "hedges-g",
        nBasis: "effect sizes",
        locator: "abstract",
      },
    ],
    caveats: [
      "Comparison conditions are heterogeneous (restudy, filler, no treatment), so this estimate is not directly comparable to Rowland's restudy-only contrast and the two should not be averaged.",
    ],
    replication: "replicated",
  },

  "dunlosky-2013-techniques": {
    id: "dunlosky-2013-techniques",
    authors: ["Dunlosky, J.", "Rawson, K. A.", "Marsh, E. J.", "Nathan, M. J.", "Willingham, D. T."],
    year: 2013,
    title: "Improving students' learning with effective learning techniques: Promising directions from cognitive and educational psychology",
    venue: "Psychological Science in the Public Interest, 14(1), 4-58",
    design: "review",
    findings: [],
    caveats: [
      "A utility rating across ten techniques, not a pooled effect size. Only practice testing and distributed practice were rated high utility — which is a statement about breadth of evidence and generalisability, not about magnitude in any one setting.",
    ],
    replication: "n/a",
  },
} as const satisfies Record<string, Paper>;

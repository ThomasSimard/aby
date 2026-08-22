import type { Paper } from "../types.ts";

/**
 * How to present material, and how much a tutor can be expected to add.
 *
 * VanLehn is here mainly to bound what aby's own README is allowed to claim.
 */
export const INSTRUCTION = {
  "kalyuga-2003-expertise-reversal": {
    id: "kalyuga-2003-expertise-reversal",
    authors: ["Kalyuga, S.", "Ayres, P.", "Chandler, P.", "Sweller, J."],
    year: 2003,
    title: "The expertise reversal effect",
    venue: "Educational Psychologist, 38(1), 23-31",
    design: "review",
    findings: [],
    caveats: [
      "A review of studies rather than a pooled estimate; the direction (worked examples help low-knowledge learners and lose or reverse their advantage as prior knowledge grows) is well supported, the crossover POINT is not specified and is domain-dependent.",
      "Expertise here means within-domain knowledge of the specific content. aby's assessed `level` is per topic and self-report-informed, so mapping a 0-5 level onto this crossover is our inference, not theirs.",
    ],
    replication: "replicated",
  },

  "vanlehn-2011-tutoring": {
    id: "vanlehn-2011-tutoring",
    authors: ["VanLehn, K."],
    year: 2011,
    title: "The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems",
    venue: "Educational Psychologist, 46(4), 197-221",
    design: "meta-analysis",
    findings: [
      {
        id: "its-vs-no-tutoring-d",
        quantity: "intelligent tutoring systems versus no tutoring",
        value: 0.76,
        unit: "cohens-d",
        nBasis: "studies",
        locator: "abstract",
      },
      {
        id: "human-vs-no-tutoring-d",
        quantity: "human tutoring versus no tutoring",
        value: 0.79,
        unit: "cohens-d",
        nBasis: "studies",
        locator: "abstract",
      },
    ],
    caveats: [
      "The comparison is against no tutoring, not against ordinary classroom instruction.",
      "Its main use in this corpus is negative: it is the empirical correction to Bloom's '2 sigma', and it bounds what aby may claim about itself.",
    ],
    replication: "replicated",
  },

  "bloom-1984-two-sigma": {
    id: "bloom-1984-two-sigma",
    authors: ["Bloom, B. S."],
    year: 1984,
    title: "The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring",
    venue: "Educational Researcher, 13(6), 4-16",
    design: "review",
    findings: [
      {
        id: "two-sigma-d",
        quantity: "one-to-one mastery tutoring versus conventional group instruction, as reported",
        value: 2,
        unit: "cohens-d",
        nBasis: "studies",
        locator: "abstract",
      },
    ],
    caveats: [
      "The 2-sigma figure comes from two small dissertation studies with short interventions and researcher-designed outcome measures. It has not replicated at anything like that magnitude; VanLehn (2011) puts human tutoring nearer d = 0.79.",
      "Recorded here specifically so the number cannot be cited in this repository without its correction attached.",
    ],
    replication: "unreplicated",
  },
} as const satisfies Record<string, Paper>;

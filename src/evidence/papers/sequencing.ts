import type { Paper } from "../types.ts";

/**
 * What order to present things in.
 *
 * Brunmair & Richter is the corpus's clearest demonstration of why moderators are
 * stored: the headline effect is positive, and for one common material type the
 * sign flips. A corpus holding only point estimates would have licensed a change
 * that the evidence forbids.
 */
export const SEQUENCING = {
  "brunmair-2019-interleaving": {
    id: "brunmair-2019-interleaving",
    authors: ["Brunmair, M.", "Richter, T."],
    year: 2019,
    title: "Similarity matters: A meta-analysis of interleaved learning and its moderators",
    venue: "Psychological Bulletin, 145(11), 1029-1052",
    doi: "10.1037/bul0000209",
    design: "meta-analysis",
    findings: [
      {
        id: "overall-g",
        quantity: "interleaved versus blocked practice, overall",
        value: 0.42,
        unit: "hedges-g",
        n: 238,
        nBasis: "effect sizes",
        locator: "abstract",
      },
      {
        id: "paintings-g",
        quantity: "interleaved versus blocked practice, paintings",
        value: 0.67,
        unit: "hedges-g",
        moderator: "material = paintings",
        locator: "abstract",
      },
      {
        id: "math-g",
        quantity: "interleaved versus blocked practice, mathematical tasks",
        value: 0.34,
        unit: "hedges-g",
        moderator: "material = mathematical tasks",
        locator: "abstract",
      },
      {
        id: "words-g",
        quantity: "interleaved versus blocked practice, word learning - NEGATIVE, blocking wins",
        value: -0.39,
        unit: "hedges-g",
        moderator: "material = words",
        locator: "abstract",
      },
    ],
    caveats: [
      "59 studies, 238 effect sizes in 158 samples. Expository texts gave a non-significant overall effect, which is the material type closest to what aby teaches.",
      "The overall g = 0.42 is not usable on its own: the effect is strongly moderated by material similarity and reverses for words. Citing the headline alone would misrepresent the paper.",
    ],
    replication: "replicated",
  },

  "falmagne-1990-knowledge-spaces": {
    id: "falmagne-1990-knowledge-spaces",
    authors: ["Falmagne, J.-C.", "Koppen, M.", "Villano, M.", "Doignon, J.-P.", "Johannesen, L."],
    year: 1990,
    title: "Introduction to knowledge spaces: How to build, test, and search them",
    venue: "Psychological Review, 97(2), 201-224",
    design: "framework",
    findings: [],
    caveats: [
      "A formal framework, not an efficacy study. It justifies representing competence as prerequisite-closed states with a fringe of immediately learnable items — which is what aby's roadmap DAG and its available/locked distinction already are.",
      "It does NOT rank the fringe. Any rule for choosing among simultaneously-available nodes is ours, and must be bound as such.",
    ],
    replication: "n/a",
  },
} as const satisfies Record<string, Paper>;

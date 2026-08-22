import type { Paper } from "../types.ts";

/**
 * Sources for what is DONE, as opposed to what works.
 *
 * These back `sort: "practice"` claims, which are the only claims a `conventional`
 * binding may cite. Keeping them in their own file makes the distinction visible on
 * disk: nothing in here is evidence that anything helps anyone learn.
 */
export const PRACTICE = {
  "wozniak-1990-optimization-of-learning": {
    id: "wozniak-1990-optimization-of-learning",
    authors: ["Wozniak, P. A."],
    year: 1990,
    title: "Optimization of learning: A new approach and computer application",
    venue: "Master's thesis, University of Technology in Poznan",
    design: "observational",
    findings: [
      {
        id: "initial-ease-factor",
        quantity: "SM-2 initial ease factor for a new item",
        value: 2.5,
        unit: "count",
        locator: "the SM-2 algorithm as published in the thesis and on super-memo.com",
      },
      {
        id: "minimum-ease-factor",
        quantity: "SM-2 lower clamp on the ease factor",
        value: 1.3,
        unit: "count",
        locator: "the SM-2 algorithm as published in the thesis and on super-memo.com",
      },
    ],
    caveats: [
      "NOT AN EFFICACY STUDY, and not peer reviewed. SM-2's constants were chosen by inspection of the author's own repetition histories in the 1980s; there is no controlled trial behind 2.5, 1.3, the 1-then-6-day ladder, or the ease-update polynomial.",
      "Recorded so those numbers have a traceable origin. Their origin is not evidence that they are good values, and every binding citing this paper is `conventional` for that reason.",
      "The population was one adult learning foreign-language vocabulary and biology facts. aby teaches multi-concept nodes graded by a language model.",
    ],
    replication: "n/a",
  },
} as const satisfies Record<string, Paper>;

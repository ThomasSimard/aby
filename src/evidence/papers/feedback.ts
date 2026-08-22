import type { Paper } from "../types.ts";

/**
 * Feedback — the one part of aby's pedagogy where the evidence is genuinely
 * two-sided, and where doing more of the obvious thing can make outcomes worse.
 */
export const FEEDBACK = {
  "kluger-denisi-1996-feedback": {
    id: "kluger-denisi-1996-feedback",
    authors: ["Kluger, A. N.", "DeNisi, A."],
    year: 1996,
    title: "The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory",
    venue: "Psychological Bulletin, 119(2), 254-284",
    design: "meta-analysis",
    findings: [
      {
        id: "share-reducing-performance",
        quantity: "share of feedback interventions that REDUCED performance",
        value: 0.33,
        unit: "ratio",
        nBasis: "effect sizes",
        locator: "abstract - approximate, 'over one third' as commonly reported; exact figure not yet read at source",
      },
    ],
    caveats: [
      "Largely workplace and laboratory task performance rather than tutoring, so transfer is an assumption.",
      "The moderator that matters is where feedback directs attention: feedback about the SELF is where the harm concentrates; feedback about the TASK is where the benefit is. That distinction is the reason aby's grading rule is worded about the answer rather than the learner.",
      "The exact proportion is recorded with a loose locator and must not be used in a `reported` binding until read at source.",
    ],
    replication: "replicated",
  },

  "hattie-timperley-2007-feedback": {
    id: "hattie-timperley-2007-feedback",
    authors: ["Hattie, J.", "Timperley, H."],
    year: 2007,
    title: "The power of feedback",
    venue: "Review of Educational Research, 77(1), 81-112",
    design: "review",
    findings: [],
    caveats: [
      "A synthesis and a model rather than a new pooled estimate; it is cited here for the task/process/self-regulation/self distinction, not for a magnitude.",
    ],
    replication: "n/a",
  },
} as const satisfies Record<string, Paper>;

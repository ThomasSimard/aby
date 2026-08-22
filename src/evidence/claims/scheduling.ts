import type { Claim } from "../types.ts";

/** Claims that constrain when a node comes back. */
export const SCHEDULING_CLAIMS = {
  "spacing/optimal-gap-grows-with-retention-interval": {
    id: "spacing/optimal-gap-grows-with-retention-interval",
    statement:
      "The inter-study gap that maximises later retention increases as the retention interval increases; there is no single best gap independent of how long the material must last.",
    implication:
      "Review intervals should expand across successive successes. This licenses the DIRECTION only — no interval ladder, and nothing about scaling by an ease factor, follows from it.",
    sort: "empirical",
    supportedBy: [
      { paper: "cepeda-2006-distributed-practice" },
      { paper: "cepeda-2008-ridgeline" },
    ],
    contradictedBy: [],
    moderators: [
      "Established on verbal recall of discrete facts; expansion rate for multi-concept procedural material is unstudied.",
      "Both sources study a single review episode, not a long repeated-review sequence.",
    ],
    strength: "strong",
  },

  "spacing/gap-ratio-declines-as-horizon-lengthens": {
    id: "spacing/gap-ratio-declines-as-horizon-lengthens",
    statement:
      "Expressed as a fraction of the retention interval, the optimal gap shrinks as the retention interval grows - roughly a fifth of the delay at a few weeks, around a twentieth at a year.",
    implication:
      "If aby ever schedules against a stated retention horizon, the gap should be a declining fraction of it rather than a fixed multiple of the last interval. Not yet acted on: aby stores no horizon.",
    sort: "empirical",
    supportedBy: [
      { paper: "cepeda-2008-ridgeline", finding: "optimal-gap-ratio-weeks" },
      { paper: "cepeda-2008-ridgeline", finding: "optimal-gap-ratio-one-year" },
    ],
    contradictedBy: [],
    moderators: [
      "The ratios are currently recorded from the abstract, not the per-condition table.",
      "Defined relative to a KNOWN retention interval, which aby does not have.",
    ],
    strength: "moderate",
    strengthRationale:
      "The shape of the result is solid and replicated; the specific ratios in this corpus have not yet been read off the paper's own table, so they are not yet fit to derive a parameter from.",
  },

  "practice/sm2-is-the-de-facto-default-scheduler": {
    id: "practice/sm2-is-the-de-facto-default-scheduler",
    statement:
      "SM-2, with an initial ease factor of 2.5 clamped below at 1.3, is the scheduling algorithm most spaced-repetition software has shipped by default since 1990.",
    implication:
      "Inheriting SM-2's constants is a defensible starting point on grounds of convention and interoperability. It is not a claim that those constants are good ones.",
    sort: "practice",
    supportedBy: [
      { paper: "wozniak-1990-optimization-of-learning", finding: "initial-ease-factor" },
      { paper: "wozniak-1990-optimization-of-learning", finding: "minimum-ease-factor" },
    ],
    contradictedBy: [],
    moderators: [],
    strength: "strong",
  },
} as const satisfies Record<string, Claim>;

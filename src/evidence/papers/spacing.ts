import type { Paper } from "../types.ts";

/**
 * Distributed practice — how the gap between encounters changes what survives.
 *
 * The two Cepeda papers are the reason aby schedules anything at all. Note what
 * they do *not* license: neither one derives an interval ladder, and neither one
 * says anything about multiplying by an ease factor. They constrain a direction and
 * a ratio, and the bindings say only that much.
 */
export const SPACING = {
  "cepeda-2006-distributed-practice": {
    id: "cepeda-2006-distributed-practice",
    authors: ["Cepeda, N. J.", "Pashler, H.", "Vul, E.", "Wixted, J. T.", "Rohrer, D."],
    year: 2006,
    title: "Distributed practice in verbal recall tasks: A review and quantitative synthesis",
    venue: "Psychological Bulletin, 132(3), 354-380",
    doi: "10.1037/0033-2909.132.3.354",
    design: "meta-analysis",
    findings: [],
    caveats: [
      "839 assessments across 317 experiments in 184 articles, but overwhelmingly verbal recall of word lists and paired associates in laboratory sessions — not multi-concept procedural material of the kind aby teaches.",
      "The headline result is directional (the inter-study interval producing maximal retention grows as the retention interval grows). No single effect size from this paper is bound to a parameter, deliberately: the direction is what replicates, the magnitude is material-dependent.",
    ],
    replication: "replicated",
  },

  "cepeda-2008-ridgeline": {
    id: "cepeda-2008-ridgeline",
    authors: ["Cepeda, N. J.", "Vul, E.", "Rohrer, D.", "Wixted, J. T.", "Pashler, H."],
    year: 2008,
    title: "Spacing effects in learning: A temporal ridgeline of optimal retention",
    venue: "Psychological Science, 19(11), 1095-1102",
    doi: "10.1111/j.1467-9280.2008.02209.x",
    design: "randomised-experiment",
    findings: [
      {
        id: "optimal-gap-ratio-weeks",
        quantity: "optimal inter-study gap as a fraction of the retention interval, at a delay of a few weeks",
        value: 0.2,
        unit: "ratio",
        n: 1354,
        nBasis: "participants",
        moderator: "retention interval = a few weeks",
        locator: "abstract - NOT YET READ OFF THE PER-CONDITION TABLE",
      },
      {
        id: "optimal-gap-ratio-one-year",
        quantity: "optimal inter-study gap as a fraction of the retention interval, at a one-year delay",
        value: 0.05,
        unit: "ratio",
        n: 1354,
        nBasis: "participants",
        moderator: "retention interval = 1 year",
        locator: "abstract - NOT YET READ OFF THE PER-CONDITION TABLE",
      },
    ],
    caveats: [
      "BOTH VALUES COME FROM THE ABSTRACT, NOT THE PAPER'S OWN TABLE. They must not be used in a `derived` binding until the per-condition optimal gaps have been read out of the paper — a rounded number from an abstract dressed up as a derivation is exactly the laundering this corpus exists to prevent.",
      "Material was obscure facts (trivia-style declarative items), reviewed once. aby reviews the same node many times, so applying a single-review ridgeline across a repeated-review sequence is an extrapolation the paper does not make.",
      "The ridgeline is defined relative to a KNOWN retention interval. aby does not store one; introducing a retention horizon to use this result is an assumption of ours, not a finding of theirs.",
    ],
    replication: "replicated",
  },
} as const satisfies Record<string, Paper>;

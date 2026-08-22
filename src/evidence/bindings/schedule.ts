import type { Binding } from "../types.ts";
import type { CodeParamId, ImpliedParamId } from "../params.ts";

/**
 * Parameters in `src/schedule.ts` — when a node comes back, and when it counts as
 * known.
 *
 * The honest summary of this file: aby's review schedule is inherited convention
 * and its mastery rule is an unexamined assumption. Nothing here is evidence that
 * these are good numbers, and the provenance kinds say so.
 */
export const SCHEDULE_BINDINGS = {
  "schedule/min-ease": {
    param: "schedule/min-ease",
    target: { kind: "const", module: "src/schedule.ts", exportName: "MIN_EASE" },
    value: 1.3,
    provenance: {
      kind: "conventional",
      implementation: "SM-2 (SuperMemo 2)",
      version: "as published in Wozniak 1990",
      caveat:
        "Chosen by inspection of one author's own repetition logs in the late 1980s. No controlled trial establishes 1.3, and no published derivation exists.",
      switchWhen:
        "aby has stored at least 200 graded reviews carrying (prior interval, elapsed days, outcome) across at least 20 nodes — enough to fit a retention curve and check whether a floor is doing anything.",
    },
    claims: ["practice/sm2-is-the-de-facto-default-scheduler"],
    notes:
      "Its job is to stop a repeatedly-failed item springing back to long intervals. That job is real; this particular value is not evidenced.",
  },

  "schedule/default-ease": {
    param: "schedule/default-ease",
    target: { kind: "const", module: "src/schedule.ts", exportName: "DEFAULT_EASE" },
    value: 2.5,
    provenance: {
      kind: "conventional",
      implementation: "SM-2 (SuperMemo 2)",
      version: "as published in Wozniak 1990",
      caveat:
        "Same origin as the floor, same absence of a trial. It sets how fast intervals grow for every new node, which makes it one of the most consequential unevidenced numbers in the repository.",
      switchWhen:
        "same as schedule/min-ease — 200 graded reviews across 20 nodes, then fit rather than inherit.",
    },
    claims: ["practice/sm2-is-the-de-facto-default-scheduler"],
  },

  "schedule/mastery-threshold": {
    param: "schedule/mastery-threshold",
    target: { kind: "const", module: "src/schedule.ts", exportName: "MASTERY_THRESHOLD" },
    value: 0.8,
    provenance: {
      kind: "unsourced",
      rationale:
        "0.8 was chosen because it reads as 'mostly right' on a 0..1 scale. It is the single most load-bearing number in aby — it defines mastered, gates every prerequisite, and decides when the roadmap is done — and nothing supports it.",
      openQuestion:
        "What should a mastery cut be, given aby's mastery is a moving average of model-assigned scores? The nearest thing in the literature is BKT's 0.95 (see claim mastery/bkt-declares-mastery-at-p-95), but that is a posterior probability under a model with guess and slip parameters, not an average of grades — transplanting the number would be a category error. Either adopt knowledge tracing so the two become comparable, or find a criterion appropriate to an EMA.",
    },
    claims: [],
  },

  "schedule/mastery-alpha": {
    param: "schedule/mastery-alpha",
    target: { kind: "const", module: "src/schedule.ts", exportName: "MASTERY_ALPHA" },
    value: 0.4,
    provenance: {
      kind: "bounded",
      lo: {
        from: {
          derive: "ema-alpha-reaching-in",
          inputs: [
            { param: "schedule/mastery-threshold" },
            { param: "mastery/crossings-to-threshold" },
          ],
        },
      },
      hi: {
        from: {
          derive: "ema-alpha-strictly-below-reaching-in",
          inputs: [
            { param: "schedule/mastery-threshold" },
            { param: "mastery/crossings-to-threshold" },
          ],
        },
      },
      rationale:
        "CLAUDE.md justifies 0.4 as 'four correct answers are needed to cross the threshold from zero'. That is a derivation — but not of 0.4. Requiring exactly four crossings pins alpha to [1 - 0.2^(1/4), 1 - 0.2^(1/3)) = [0.3313, 0.4152), and 0.4 is one point inside it. The interval is arithmetic; the point is a preference. Note that both endpoints trace to parameters rather than to any paper, so this bound is internal consistency, not evidence — and the crossings requirement it rests on is itself unsourced.",
    },
    claims: [],
  },

  "mastery/crossings-to-threshold": {
    param: "mastery/crossings-to-threshold",
    target: {
      kind: "implied",
      note:
        "No code site. It is the assumption hidden inside MASTERY_ALPHA: how many consecutive correct answers should take a learner from nothing to mastered. Naming it is what makes it arguable.",
    },
    value: 4,
    provenance: {
      kind: "unsourced",
      rationale:
        "Four is what the current alpha implies, read backwards. Nobody chose four; four fell out of choosing 0.4.",
      openQuestion:
        "How many correct answers should it take to call a topic mastered, and should it depend on the difficulty of the questions asked? Any answer needs a view on how much information one model-graded answer carries, which aby has never articulated.",
    },
    claims: [],
  },
} as const satisfies Partial<Record<CodeParamId | ImpliedParamId, Binding>>;

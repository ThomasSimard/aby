import type { Binding } from "../types.ts";
import type { ImpliedParamId } from "../params.ts";

/**
 * Parameters that live in a prompt.
 *
 * Every one of these was a number in a sentence in `skills/tutor/SKILL.md` — a
 * decision about how a session runs, sitting where no scan over `src/` would ever
 * find it. They are pulled out here because the alternative is a class of parameter
 * that is exempt from the whole exercise purely by virtue of being prose.
 *
 * All six are unsourced, which is the honest state of aby's session shape.
 */
export const PROMPT_PARAM_BINDINGS = {
  "assess/questions-per-topic-min": {
    param: "assess/questions-per-topic-min",
    target: { kind: "implied", note: "The lower end of 'usually 3-6 questions per topic' in the tutor's assessment rules." },
    value: 3,
    provenance: {
      kind: "unsourced",
      rationale: "A floor on how much probing counts as having placed someone. Chosen by feel.",
      openQuestion:
        "How few items can support a level judgement that then gates an entire roadmap? Three observations of a noisy, model-graded signal is very little, and the cost of being wrong is a curriculum built on the wrong starting point.",
    },
    claims: [],
  },

  "assess/questions-per-topic-max": {
    param: "assess/questions-per-topic-max",
    target: { kind: "implied", note: "The upper end of 'usually 3-6 questions per topic'." },
    value: 6,
    provenance: {
      kind: "unsourced",
      rationale: "A ceiling to stop the interview turning into an exam. Chosen by feel.",
      openQuestion:
        "Is the right stopping rule a question count at all, rather than a confidence criterion on the estimated level? A count is what an adaptive test would replace first.",
    },
    claims: [],
  },

  "roadmap/node-count-min": {
    param: "roadmap/node-count-min",
    target: { kind: "implied", note: "The lower end of '8-20 nodes is usually right'." },
    value: 8,
    provenance: {
      kind: "unsourced",
      rationale: "Below this a roadmap looks too thin to be a plan. No evidence.",
      openQuestion:
        "Does roadmap size affect whether a learner keeps going, and if so is the operative quantity the node count or the expected time to the goal? Node count is a proxy for something aby never measures.",
    },
    claims: [],
  },

  "roadmap/node-count-max": {
    param: "roadmap/node-count-max",
    target: { kind: "implied", note: "The upper end of '8-20 nodes is usually right'." },
    value: 20,
    provenance: {
      kind: "unsourced",
      rationale: "Above this the goal is treated as too broad. No evidence.",
      openQuestion: "Same question as the lower bound, from the other side.",
    },
    claims: [],
  },

  "roadmap/skip-at-or-above-level": {
    param: "roadmap/skip-at-or-above-level",
    target: {
      kind: "implied",
      note: "The cut in 'do not add nodes for skills already assessed at level 4-5' — on the 0-5 scale defined by aby_record_assessment.",
    },
    value: 4,
    provenance: {
      kind: "unsourced",
      rationale:
        "Level 4 is 'fluent' on aby's own scale, and fluent is treated as done. The principle — do not teach what is already in the knowledge state — is sound; this particular cut on this particular scale is not evidenced, and the scale is itself an unvalidated rubric.",
      openQuestion:
        "Where on a self-report-informed 0-5 scale does 'no longer worth teaching' actually fall, and how much does an over-generous level 4 cost? Getting this wrong silently removes material from the roadmap, which is the least visible failure aby has.",
    },
    claims: [],
  },

  "grade/score-partial-credit": {
    param: "grade/score-partial-credit",
    target: {
      kind: "implied",
      note: "The '~0.5' in the tutor's grading rubric: a right answer with shaky or missing reasoning.",
    },
    value: 0.5,
    provenance: {
      kind: "unsourced",
      rationale:
        "The midpoint, used because it is the midpoint. It is also the single most consequential number in the rubric: 0.5 sits exactly on the boundary where the reported lapse flag and the actual schedule disagree, so the most commonly assigned partial score is the one landing on the defect.",
      openQuestion:
        "What should a right-answer-wrong-reasoning reponse be worth, and should reasoning and answer be scored separately rather than collapsed into one number? A single 0..1 score is doing the work of two judgements.",
    },
    claims: [],
  },
} as const satisfies Partial<Record<ImpliedParamId, Binding>>;

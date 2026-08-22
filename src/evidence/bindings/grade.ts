import type { Binding } from "../types.ts";
import type { CodeParamId } from "../params.ts";

/** Parameters in `src/grade.ts` — what a score means once it is recorded. */
export const GRADE_BINDINGS = {
  "grade/lapse-threshold": {
    param: "grade/lapse-threshold",
    target: { kind: "const", module: "src/grade.ts", exportName: "LAPSE_THRESHOLD" },
    value: 0.6,
    provenance: {
      kind: "unsourced",
      rationale:
        "0.6 is where 'not good enough' was felt to start. No source gives it, and it is not even the number the scheduler acts on.",
      openQuestion:
        "What score should count as a failure, and should there be one boundary or two? THERE IS A LIVE DEFECT HERE: this 0.6 decides the `lapsed` flag shown to the learner and to the model, while `scheduleNext` lapses on `scoreToQuality(score) < 3`, which is score < 0.5 because Math.round(2.5) === 3 in JS. A score of exactly 0.5 is reported as a lapse and scheduled as a success. Resolving that is phase 1; deciding what the boundary should BE is the open question.",
    },
    claims: [],
    notes:
      "Bound at its current value rather than at the value it ought to be, on purpose. Phase 0 records what is true today.",
  },
} as const satisfies Partial<Record<CodeParamId, Binding>>;

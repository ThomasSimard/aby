import type { Binding } from "../types.ts";
import type { CodeParamId } from "../params.ts";

/**
 * Numbers in the parameter scan that carry no pedagogical content.
 *
 * Declared rather than allowlisted. A separate invisible exceptions file is exactly
 * where an unexamined number would end up, so these live in the same registry as
 * everything else and have to say what constrains them.
 */
export const INFRA_BINDINGS = {
  "embed/dim": {
    param: "embed/dim",
    target: { kind: "const", module: "src/embed.ts", exportName: "EMBED_DIM" },
    value: 384,
    provenance: {
      kind: "technical",
      forcedBy: "the output dimension of Xenova/all-MiniLM-L6-v2",
      rationale:
        "Fixed by the embedding model, not chosen. Changing it means changing the model and rebuilding every stored vector.",
    },
    claims: [],
    notes:
      "The CHOICE of model is a different question and is not currently bound: what counts as 'already taught' is decided by this model's notion of similarity, which is a retrieval-quality decision with pedagogical consequences. Deferred, not settled.",
  },

  "verify/check-timeout-ms": {
    param: "verify/check-timeout-ms",
    target: { kind: "const", module: "src/verify.ts", exportName: "CHECK_TIMEOUT_MS" },
    value: 20000,
    provenance: {
      kind: "technical",
      forcedBy:
        "an interactive session's latency budget — a CAS call is seconds, not milliseconds, and a runaway simplify must not wedge the turn",
      rationale:
        "Changes whether a check COMPLETES, not what is taught. A timeout resolves to `inconclusive`, which is advisory by design, so this number cannot make the tutor teach anything different — only leave a step unchecked.",
    },
    claims: [],
    notes:
      "The rest of the checker's numbers — the seven probe points, 1e-9, the 1e-6 default tolerance, the i/11 stagger, 30-digit precision — are the same category and are out of the scan surface entirely. src/checkers/cas.py is Python and invisible to a TypeScript AST walk regardless; that gap is recorded here rather than left silent.",
  },
} as const satisfies Partial<Record<CodeParamId, Binding>>;

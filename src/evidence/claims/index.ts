/**
 * Claims: the join between papers and code.
 *
 * A claim is a proposition about learning stated so that it could be false, plus
 * what follows for aby if it is true. Bindings cite claims, never papers directly —
 * that indirection is what stops a parameter borrowing a paper's authority for
 * something the paper never tested.
 *
 * `strength` lives here rather than on the paper for the same reason: Cepeda 2006 is
 * strong evidence that spacing beats massing, and no evidence at all that intervals
 * should be multiplied by an ease factor.
 */
import type { Claim } from "../types.ts";
import { SCHEDULING_CLAIMS } from "./scheduling.ts";
import { MASTERY_CLAIMS } from "./mastery.ts";
import { GRADING_CLAIMS } from "./grading.ts";
import { INSTRUCTION_CLAIMS } from "./instruction.ts";
import { SEQUENCING_CLAIMS } from "./sequencing.ts";

export const CLAIMS = {
  ...SCHEDULING_CLAIMS,
  ...MASTERY_CLAIMS,
  ...GRADING_CLAIMS,
  ...INSTRUCTION_CLAIMS,
  ...SEQUENCING_CLAIMS,
} as const satisfies Record<string, Claim>;

export type ClaimId = keyof typeof CLAIMS;

/** Per-file counts, so the test can prove object spread overwrote nothing. */
export const CLAIM_GROUPS = [
  { file: "scheduling.ts", group: SCHEDULING_CLAIMS },
  { file: "mastery.ts", group: MASTERY_CLAIMS },
  { file: "grading.ts", group: GRADING_CLAIMS },
  { file: "instruction.ts", group: INSTRUCTION_CLAIMS },
  { file: "sequencing.ts", group: SEQUENCING_CLAIMS },
] as const;

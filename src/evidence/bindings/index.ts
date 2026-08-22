/**
 * The registry: every parameter in aby that influences learning, and where it came
 * from.
 *
 * The `satisfies Registry` below is doing real work. `Registry` is
 * `{ [K in ParamId]: Binding<K> }`, so a parameter declared in `params.ts` with no
 * binding here is a compile error, a binding whose key and `param` disagree is a
 * compile error, and a binding for something never declared is a compile error.
 * None of those are test failures — they fail `pnpm check`, which is a different
 * and earlier gate than `pnpm test`.
 */
import type { Binding, Registry } from "../types.ts";
import type { ParamId } from "../params.ts";
import { SCHEDULE_BINDINGS } from "./schedule.ts";
import { GRADE_BINDINGS } from "./grade.ts";
import { INFRA_BINDINGS } from "./infra.ts";
import { PROMPT_PARAM_BINDINGS } from "./prompt-params.ts";
import { PROSE_BINDINGS } from "./prose.ts";

export const BINDINGS = {
  ...SCHEDULE_BINDINGS,
  ...GRADE_BINDINGS,
  ...INFRA_BINDINGS,
  ...PROMPT_PARAM_BINDINGS,
  ...PROSE_BINDINGS,
} as const satisfies Registry;

/** Per-file counts, so the test can prove object spread overwrote nothing. */
export const BINDING_GROUPS = [
  { file: "schedule.ts", group: SCHEDULE_BINDINGS },
  { file: "grade.ts", group: GRADE_BINDINGS },
  { file: "infra.ts", group: INFRA_BINDINGS },
  { file: "prompt-params.ts", group: PROMPT_PARAM_BINDINGS },
  { file: "prose.ts", group: PROSE_BINDINGS },
] as const;

export function allBindings(): Binding[] {
  return Object.values(BINDINGS as Record<ParamId, Binding>);
}

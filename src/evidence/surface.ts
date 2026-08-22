/**
 * What the scanner looks at.
 *
 * The scanner does not try to be clever about arbitrary code, and the reason is
 * worth stating because it drove the design. A naive "classify every numeric
 * literal in the learning core" pass drowns immediately: `plan.ts` and `graph.ts`
 * between them contain `length === 0` six times, `available[0]`-style indexing five
 * times, a `.toFixed(2)`, a 24-character label wrap, a graphviz font size and four
 * hex colours. No allowlist heuristic separates those from pedagogy without
 * encoding rules like "a zero next to `.length` is fine" forever.
 *
 * So the surface is declared instead, and the way it grows is by MOVING PEDAGOGY
 * INTO IT — never by loosening the scan. `src/retrieval.ts` does not exist yet; when
 * the de-duplication budget moves out of `store.ts`, it joins `LITERAL_SCAN`.
 */

/**
 * Strict: every numeric literal must belong to a registered exported const.
 *
 * Empty in phase 0 on purpose. Turning a module on here requires it to have been
 * refactored so its numbers are named, which is phase 1's work — switching it on
 * before then would produce forty failures and teach nobody anything.
 */
export const LITERAL_SCAN: readonly string[] = [];

/** Looser: every EXPORTED number must have a binding. Live from phase 0. */
export const EXPORT_SCAN: readonly string[] = [
  "src/schedule.ts",
  "src/plan.ts",
  "src/grade.ts",
  "src/graph.ts",
  "src/embed.ts",
  "src/store.ts",
  "src/verify.ts",
  "src/view.ts",
];

/**
 * Numbers that are never a decision, in any module. Deliberately tiny: in
 * `schedule.ts` the literal `1` means "come back tomorrow", which is as pedagogical
 * as a number gets, so it is NOT on this list — a module in `LITERAL_SCAN` has to
 * account for its ones.
 */
export const NEUTRAL: ReadonlySet<number> = new Set([0]);

/** Everything pi can load. None of it may reach the corpus. */
export const RUNTIME_ROOTS: readonly string[] = ["src", "extensions"];

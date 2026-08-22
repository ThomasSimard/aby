/**
 * Derivations: the only way a parameter's value may be *computed* from evidence.
 *
 * A `derived` binding names one of these and its inputs; `test/evidence.test.ts`
 * runs it and fails if the result disagrees with the value in the registry. That is
 * what stops "derived" from being a label — you cannot write a number next to a
 * formula and have it accepted, the formula has to actually produce the number.
 *
 * Pure numeric functions, no imports, no clock. Each one is unit-tested against a
 * hand-computed value, because a derivation nobody checked is just another
 * unsourced constant with extra steps.
 */

export const DERIVATIONS = {
  /**
   * The score at which a 0..1 grade rounds down past a quality cut.
   *
   * `scoreToQuality` is `Math.round(score * qualityMax)`, and JS rounds halves up,
   * so the lowest score still reaching `cut` is `(cut - 0.5) / qualityMax`.
   */
  "score-boundary-for-quality": (qualityMax: number, cut: number): number =>
    (cut - 0.5) / qualityMax,

  /**
   * The smallest EMA weight that reaches `threshold` from zero within `k` perfect
   * answers. From m_k = 1 - (1-alpha)^k, solved for alpha.
   */
  "ema-alpha-reaching-in": (threshold: number, k: number): number =>
    1 - Math.pow(1 - threshold, 1 / k),

  /**
   * The largest EMA weight that still fails to reach `threshold` within `k-1`
   * answers. Together with `ema-alpha-reaching-in` this pins "crosses in exactly k"
   * to a half-open interval without inventing a second parameter for k-1.
   */
  "ema-alpha-strictly-below-reaching-in": (threshold: number, k: number): number =>
    1 - Math.pow(1 - threshold, 1 / (k - 1)),

  /** Identity, for a bound that is exactly another parameter's value. */
  identity: (x: number): number => x,
} as const;

export type DeriveId = keyof typeof DERIVATIONS;

/** Run a derivation by id. Throws on arity mismatch so a bad binding fails loudly. */
export function runDerivation(id: DeriveId, inputs: readonly number[]): number {
  const fn = DERIVATIONS[id] as (...args: number[]) => number;
  if (fn.length !== inputs.length) {
    throw new Error(
      `derivation "${id}" takes ${fn.length} input(s), the binding supplied ${inputs.length}`,
    );
  }
  return fn(...inputs);
}

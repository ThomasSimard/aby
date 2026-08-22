/**
 * The evidence corpus: types.
 *
 * `src/evidence/` is a TEST-TIME AND DESIGN-TIME artifact. Nothing under `src/` or
 * `extensions/` may import it, and `test/evidence.test.ts` enforces that
 * mechanically. The reason is blunt: a runtime import would pull twenty papers of
 * prose into every pi session, and the corpus exists to constrain the maintainer,
 * not to be read by the model or shown to the learner.
 *
 * One requirement shapes every type below: **it must be impossible to make an
 * arbitrary number look evidenced.** A registry where any constant can be given a
 * plausible DOI is worse than no registry, because it launders a guess into a
 * finding — the same failure `aby_check` exists to prevent on the mathematical
 * side. So the guards are structural, not conventional:
 *
 *   - `reported` must point at a numeric field of a paper record, and the test
 *     checks the numbers are equal. If no paper reports your number, the kind is
 *     unavailable to you.
 *   - `derived` must compute. The test runs the derivation.
 *   - `bounded` endpoints have no free-literal case *in the type*. An endpoint is a
 *     finding, another parameter, a logical bound, or a derivation over those.
 *   - `conventional` may cite only `sort: "practice"` claims, so an inherited
 *     number can never wear a real result's authority.
 *
 * The categories that admit ignorance — `technical`, `editorial`, `unsourced` — are
 * not escape hatches, they are the point. The honest reading of "no unsourced
 * pedagogy" is "no *silently* unsourced pedagogy": some numbers have no paper
 * behind them, and stapling one on is exactly the failure being guarded against.
 */

import type { DeriveId } from "./derive.ts";
import type { PaperFindingRef, PaperRef } from "./papers/index.ts";
import type { ClaimId } from "./claims/index.ts";
import type { ParamId } from "./params.ts";

// ---------------------------------------------------------------- papers

/** What the study actually did. Governs how much weight a claim may take from it. */
export type Design =
  | "meta-analysis"
  | "randomised-experiment"
  | "observational"
  | "model-fit"
  | "simulation"
  | "review"
  | "framework";

/**
 * How the result has held up. Recorded per paper because a famous number and a
 * replicated number are different things — Bloom's "2 sigma" is the standing
 * example, and a corpus that cannot say so is decoration.
 */
export type Replication = "replicated" | "contested" | "unreplicated" | "n/a";

/** What a reported number *is*. Prevents comparing a Hedges g to a day count. */
export type Unit =
  | "hedges-g"
  | "cohens-d"
  | "ratio"
  | "probability"
  | "days"
  | "count"
  | "percent";

/**
 * One number a paper reports.
 *
 * A list rather than a single `effectSize` field, because Brunmair & Richter is the
 * case that breaks a single field: overall g = .42, but paintings .67, maths .34,
 * and words −.39, where blocking wins outright. A corpus storing only the point
 * estimate would have licensed a blanket interleaving rule that the moderators
 * forbid — the moderators are the finding.
 */
export type Finding = {
  /** Unique within the paper: "overall-g", "words-g". Bindings cite this. */
  id: string;
  /** What was measured, in words. */
  quantity: string;
  value: number;
  unit: Unit;
  ci?: readonly [number, number];
  n?: number;
  /** What `n` counts — "participants", "effect sizes", "studies". Say which. */
  nBasis?: string;
  /** The subgroup this value is for, when it is not the overall estimate. */
  moderator?: string;
  /** Where in the paper. A finding you cannot find again is not a citation. */
  locator: string;
};

export type Paper = {
  id: string;
  authors: readonly string[];
  year: number;
  title: string;
  venue: string;
  doi?: string;
  design: Design;
  findings: readonly Finding[];
  /** Population, measurement, known criticism. Required — every paper has some. */
  caveats: readonly string[];
  replication: Replication;
};

/** Re-exported for convenience; defined in papers/index.ts, where PAPERS is in scope. */
export type { PaperFindingRef, PaperRef };

// ---------------------------------------------------------------- claims

/**
 * Whether a claim is about *what works* or about *what is done*.
 *
 * This one field is what keeps `conventional` honest. "Spaced practice beats massed
 * practice" is `empirical`. "SM-2 with EF0 = 2.5 is the de-facto default across
 * Anki, SuperMemo and Mnemosyne" is `practice` — true, checkable, and carrying no
 * efficacy content whatsoever. A `conventional` binding may cite only the second
 * sort, so an inherited constant can never quietly borrow a meta-analysis's weight.
 */
export type ClaimSort = "empirical" | "practice";

/**
 * How much the body of evidence supports the claim.
 *
 * On the claim, not on the paper. Cepeda 2006 is strong evidence for "spacing beats
 * massing" and no evidence at all for "multiply the interval by the ease factor".
 * Strength as a paper attribute would let a meta-analysis lend its authority to a
 * proposition it never tested, which is the subtlest form of the laundering this
 * whole file exists to block.
 */
export type Strength = "strong" | "moderate" | "weak" | "contested";

export type Claim = {
  id: string;
  /** Phrased so that it could be false. */
  statement: string;
  /** What follows for aby specifically — including "nothing", which is a result. */
  implication: string;
  sort: ClaimSort;
  supportedBy: readonly PaperRef[];
  contradictedBy: readonly PaperRef[];
  /** Conditions known to flip or kill the effect. */
  moderators: readonly string[];
  strength: Strength;
  /** Required unless `strength` is "strong": say why it is not. */
  strengthRationale?: string;
};

// ---------------------------------------------------------------- bindings

/**
 * An input to a derivation. `literal` is the one audited escape: it exists because
 * some derivations genuinely need a constant of arithmetic, and `forcedBy` must say
 * which. An empty `forcedBy` fails the test.
 */
export type DeriveInput =
  | { param: ParamId }
  | { paper: PaperRef }
  | { literal: number; forcedBy: string };

/**
 * An input to a *bound* endpoint. Deliberately narrower than `DeriveInput`: no
 * literals anywhere in a range, or "bounded" would become a way to write two
 * arbitrary numbers around a third.
 */
export type BoundInput = { param: ParamId } | { paper: PaperRef };

/**
 * One end of a supported range. There is no `{ value: number }` case, and that
 * absence is the whole design — the literature owns the interval, the maintainer
 * owns only the point inside it.
 */
export type Bound =
  | { from: { paper: PaperRef } }
  | { from: { param: ParamId } }
  | { from: { logical: "probability-floor" | "probability-ceiling" | "nonneg" } }
  | { from: { derive: DeriveId; inputs: readonly BoundInput[] } };

export type Provenance =
  /** The value appears in the cited finding. The test compares the two numbers. */
  | { kind: "reported"; from: PaperFindingRef }
  /** The value is computed. The test runs the derivation. */
  | { kind: "derived"; fn: DeriveId; inputs: readonly DeriveInput[] }
  /** The literature constrains a range or a direction; the point is a judgement. */
  | {
      kind: "bounded";
      lo: Bound;
      hi: Bound;
      direction?: "increasing" | "decreasing";
      rationale: string;
    }
  /**
   * Inherited from an implementation. Provenance, explicitly NOT evidence.
   * `switchWhen` is required so a convention always names what would retire it.
   */
  | {
      kind: "conventional";
      implementation: string;
      version: string;
      caveat: string;
      switchWhen: string;
    }
  /**
   * The rule follows from the cited claims. Prose only — a normative sentence has
   * no number to compare, so `reported`/`derived`/`bounded` cannot apply to it, but
   * it can still be entailed by evidence and must still name which.
   */
  | { kind: "entailed"; rationale: string }
  /**
   * Not a learning decision. An index, a unit conversion, an interface constant, a
   * tool-protocol rule, an operational budget. `forcedBy` names what actually
   * constrains the value; `rationale` says why it carries no pedagogical content.
   * May carry no claim — this is the "declared out of scope" category, and the
   * declaring is the point: a silent allowlist is where numbers go to hide.
   */
  | { kind: "technical"; forcedBy: string; rationale: string }
  /** A UX or tone choice, not a proposition about learning. May carry no claim. */
  | { kind: "editorial"; rationale: string }
  /** Admitted ignorance, with the question written down. On the ratchet. */
  | { kind: "unsourced"; rationale: string; openQuestion: string };

export type ProvenanceKind = Provenance["kind"];

export type Target =
  /** An exported const. The test reads it back and compares. */
  | { kind: "const"; module: string; exportName: string }
  /** A normative unit of prose, quoted verbatim so a reword is caught. */
  | { kind: "prose"; file: string; unit: string; quote: string }
  /**
   * No code site: an assumption other bindings depend on. `MASTERY_ALPHA = 0.4` is
   * really "four correct answers should cross the threshold", and *that* is the
   * pedagogical decision. An implied parameter nothing references is dead weight,
   * so the test requires each one to be an input somewhere.
   */
  | { kind: "implied"; note: string };

/**
 * One number appearing inside a quoted piece of prose.
 *
 * Every number the tutor is told is a parameter, whether or not anyone ever treated
 * it as one: "3-6 questions per topic" and "8-20 nodes" decide as much about a
 * session as `MIN_EASE` does, and they live in a prompt where no scan would find
 * them. Requiring each to resolve is what drags them into the registry.
 *
 * `notAParameter` is for numbers that are genuinely not decisions — a point on a
 * scale defined elsewhere, an endpoint of a 0..1 range. It needs a reason, and the
 * coverage report lists every use, because it is the one place a number could hide.
 */
export type ProseNumber =
  | { n: number; param: ParamId }
  | { n: number; notAParameter: string };

export type Binding<K extends ParamId = ParamId> = {
  param: K;
  target: Target;
  /** Required for `const` and `implied` targets; absent for prose. */
  value?: number | readonly number[];
  provenance: Provenance;
  claims: readonly ClaimId[];
  /**
   * Required on a prose target whose quote contains any number. The test checks the
   * mapping covers exactly the numbers in the quote — no more, no fewer.
   */
  numbers?: readonly ProseNumber[];
  notes?: string;
};

/**
 * Every declared parameter must have a binding, and its key must equal its `param`.
 * Both are compile errors, not test failures — see `params.ts` for why the union is
 * hand-written.
 */
export type Registry = { [K in ParamId]: Binding<K> };

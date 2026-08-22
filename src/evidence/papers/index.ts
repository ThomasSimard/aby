/**
 * The corpus.
 *
 * Split by primary contribution, not by which parameter uses it: a paper that says
 * something about two areas still has one place it belongs, and cross-area use
 * happens through claims, which are inherently topical.
 *
 * `doi` is present only where it has been verified. An unverified DOI is worse than
 * none — it looks like a checkable citation and is not one.
 *
 * Papers arrive when a binding or a claim needs them. An unreferenced paper is dead
 * weight, and `report.ts` flags it.
 */
import type { Paper } from "../types.ts";
import { SPACING } from "./spacing.ts";
import { RETRIEVAL } from "./retrieval.ts";
import { INSTRUCTION } from "./instruction.ts";
import { FEEDBACK } from "./feedback.ts";
import { SEQUENCING } from "./sequencing.ts";
import { MODELLING } from "./modelling.ts";
import { METACOGNITION } from "./metacognition.ts";
import { PRACTICE } from "./practice.ts";

export const PAPERS = {
  ...SPACING,
  ...RETRIEVAL,
  ...INSTRUCTION,
  ...FEEDBACK,
  ...SEQUENCING,
  ...MODELLING,
  ...METACOGNITION,
  ...PRACTICE,
} as const satisfies Record<string, Paper>;

export type PaperId = keyof typeof PAPERS;

/** The finding ids a given paper actually declares. */
export type FindingIdOf<K extends PaperId> = (typeof PAPERS)[K]["findings"][number]["id"];

/**
 * A pointer into the corpus, with the finding id checked against the paper it names.
 *
 * The mapped-then-indexed form is what makes that possible: a plain
 * `{ paper: PaperId; finding?: string }` would accept any finding on any paper, and
 * citations rot in exactly that direction — the paper stays put while the number
 * moves, is renamed, or turns out never to have been there. Here, deleting a
 * finding breaks every citation to it at COMPILE time.
 *
 * `finding` is optional because a paper can support a directional claim - "optimal
 * spacing grows with the retention interval" - without any one number being what
 * you are relying on.
 */
export type PaperRef = { [K in PaperId]: { paper: K; finding?: FindingIdOf<K> } }[PaperId];

/** A pointer that must name a number. Required by `reported` provenance. */
export type PaperFindingRef = { [K in PaperId]: { paper: K; finding: FindingIdOf<K> } }[PaperId];

/**
 * Per-file counts, so the test can prove no id was silently overwritten. Object
 * spread has no duplicate-key error: two files claiming the same id would leave one
 * paper quietly replaced by another.
 */
export const PAPER_GROUPS = [
  { file: "spacing.ts", group: SPACING },
  { file: "retrieval.ts", group: RETRIEVAL },
  { file: "instruction.ts", group: INSTRUCTION },
  { file: "feedback.ts", group: FEEDBACK },
  { file: "sequencing.ts", group: SEQUENCING },
  { file: "modelling.ts", group: MODELLING },
  { file: "metacognition.ts", group: METACOGNITION },
  { file: "practice.ts", group: PRACTICE },
] as const;

/**
 * The maintainer's dashboard: what is evidenced, what is inherited, what is guessed.
 *
 * Pure — width in, lines out — following the same convention as `src/view.ts`, so
 * its layout is testable without a terminal. `scripts/evidence.ts` is the driver.
 */
import type { Binding, Claim, Paper, ProvenanceKind } from "./types.ts";
import type { ParamId } from "./params.ts";
import {
  BINDINGS,
  CLAIMS,
  PAPERS,
  allBindings,
  unboundClaims,
  unreferencedPapers,
} from "./index.ts";
import { MAX_UNSOURCED, UNSOURCED } from "./ratchet.ts";

/** Kinds in the order they should be read: strongest provenance first. */
const KIND_ORDER: ProvenanceKind[] = [
  "reported",
  "derived",
  "bounded",
  "entailed",
  "conventional",
  "technical",
  "editorial",
  "unsourced",
];

const KIND_GLOSS: Record<ProvenanceKind, string> = {
  reported: "the value is a number a paper reports",
  derived: "computed from cited quantities",
  bounded: "inside a range the literature or arithmetic fixes",
  entailed: "a prose rule following from cited claims",
  conventional: "inherited from an implementation, not from evidence",
  technical: "not a learning decision",
  editorial: "a tone or interaction choice",
  unsourced: "nothing behind it",
};

function wrap(text: string, width: number, indent: string): string[] {
  const budget = Math.max(20, width - indent.length);
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= budget) line += ` ${word}`;
    else {
      out.push(indent + line);
      line = word;
    }
  }
  if (line.length > 0) out.push(indent + line);
  return out;
}

function bar(n: number, total: number, cells: number): string {
  if (total === 0) return "";
  const filled = Math.round((n / total) * cells);
  return "#".repeat(filled) + ".".repeat(Math.max(0, cells - filled));
}

export function renderCoverage(width: number): string[] {
  const w = Math.max(48, width);
  const bindings = allBindings();
  const out: string[] = [];

  out.push("aby evidence coverage");
  out.push("=".repeat(Math.min(w, 60)));
  out.push("");

  const counts = new Map<ProvenanceKind, number>();
  for (const b of bindings) {
    counts.set(b.provenance.kind, (counts.get(b.provenance.kind) ?? 0) + 1);
  }

  out.push(`${bindings.length} parameters, ${Object.keys(CLAIMS).length} claims, ${Object.keys(PAPERS).length} papers`);
  out.push("");
  for (const kind of KIND_ORDER) {
    const n = counts.get(kind) ?? 0;
    if (n === 0) continue;
    out.push(
      `  ${kind.padEnd(13)} ${String(n).padStart(3)}  ${bar(n, bindings.length, 20)}  ${KIND_GLOSS[kind]}`,
    );
  }
  out.push("");

  // Per-module, so "which of this file's numbers are guesses" is one glance.
  const byModule = new Map<string, Binding[]>();
  for (const b of bindings) {
    if (b.target.kind !== "const") continue;
    const list = byModule.get(b.target.module) ?? [];
    list.push(b);
    byModule.set(b.target.module, list);
  }
  if (byModule.size > 0) {
    out.push("by module");
    for (const [module, list] of [...byModule].sort()) {
      const kinds = list.map((b) => b.provenance.kind);
      const guessed = kinds.filter((k) => k === "unsourced").length;
      out.push(`  ${module.padEnd(22)} ${String(list.length).padStart(2)} bound, ${guessed} unsourced`);
    }
    out.push("");
  }

  out.push(`ratchet: ${UNSOURCED.length}/${MAX_UNSOURCED} unsourced`);
  out.push("");
  out.push("open questions");
  out.push("-".repeat(Math.min(w, 60)));
  for (const id of UNSOURCED) {
    const b = (BINDINGS as Record<ParamId, Binding>)[id];
    const p = b.provenance;
    out.push("");
    out.push(`  ${id}`);
    if (p.kind === "unsourced") out.push(...wrap(p.openQuestion, w, "    "));
  }

  const dead = unreferencedPapers();
  const leads = unboundClaims();
  if (dead.length > 0 || leads.length > 0) {
    out.push("");
    out.push("not yet used");
    out.push("-".repeat(Math.min(w, 60)));
    for (const id of dead) {
      const p: Paper = PAPERS[id];
      out.push(`  paper  ${id} (${p.year}) - no claim cites it`);
    }
    for (const id of leads) {
      const c: Claim = CLAIMS[id];
      out.push(`  claim  ${id} [${c.strength}] - no parameter cites it`);
    }
  }

  return out;
}

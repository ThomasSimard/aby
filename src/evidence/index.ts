/**
 * Query surface over the corpus. Used by `report.ts` and by the test; never by
 * anything pi loads.
 */
import type { Binding, Claim, Paper, ProvenanceKind } from "./types.ts";
import type { ParamId } from "./params.ts";
import { PAPERS, type PaperId } from "./papers/index.ts";
import { CLAIMS, type ClaimId } from "./claims/index.ts";
import { BINDINGS, allBindings } from "./bindings/index.ts";

export { PAPERS, CLAIMS, BINDINGS, allBindings };
export type { PaperId, ClaimId };

export function paper(id: PaperId): Paper {
  return PAPERS[id];
}

export function claim(id: ClaimId): Claim {
  return CLAIMS[id];
}

export function binding(id: ParamId): Binding {
  return (BINDINGS as Record<ParamId, Binding>)[id];
}

/** Bindings whose target is an exported const in `module`. */
export function bindingsFor(module: string): Binding[] {
  return allBindings().filter(
    (b) => b.target.kind === "const" && b.target.module === module,
  );
}

export function bindingsOfKind(kind: ProvenanceKind): Binding[] {
  return allBindings().filter((b) => b.provenance.kind === kind);
}

/** Every paper id a claim cites, in either direction. */
export function papersCitedBy(c: Claim): PaperId[] {
  return [...c.supportedBy, ...c.contradictedBy].map((r) => r.paper);
}

/**
 * Papers no claim cites. Not an error — a paper can be read before it is used — but
 * dead weight if it stays that way, so the report shows it.
 */
export function unreferencedPapers(): PaperId[] {
  const cited = new Set<string>();
  for (const c of Object.values(CLAIMS) as Claim[]) {
    for (const id of papersCitedBy(c)) cited.add(id);
  }
  return (Object.keys(PAPERS) as PaperId[]).filter((id) => !cited.has(id));
}

/** Claims no binding cites. Research leads, or clutter. */
export function unboundClaims(): ClaimId[] {
  const used = new Set<string>();
  for (const b of allBindings()) for (const c of b.claims) used.add(c);
  return (Object.keys(CLAIMS) as ClaimId[]).filter((id) => !used.has(id));
}

/**
 * Whether a binding's provenance rests on a paper at all.
 *
 * This decides whether citing a claim is REQUIRED. A `bounded` parameter whose
 * endpoints both trace to other parameters is internal arithmetic, not evidence,
 * and demanding a citation for it would manufacture exactly the false provenance
 * the registry exists to prevent. `schedule/mastery-alpha` is that case.
 */
export function restsOnPaper(b: Binding): boolean {
  const p = b.provenance;
  switch (p.kind) {
    case "reported":
      return true;
    case "derived":
      return p.inputs.some((i) => "paper" in i);
    case "bounded":
      return [p.lo, p.hi].some((bound) => {
        const f = bound.from;
        if ("paper" in f) return true;
        if ("derive" in f) return f.inputs.some((i) => "paper" in i);
        return false;
      });
    case "conventional":
    case "entailed":
      return true;
    default:
      return false;
  }
}

/**
 * Failure text.
 *
 * This repository's convention is that an error message is a prompt — an unknown
 * node id lists the known ids so the reader can recover without going and looking.
 * The same standard applies here, and it matters more, because the person hitting
 * these messages is being asked to do something they did not set out to do: justify
 * a number they were about to write. A message that only says "no" makes the gate
 * an obstacle. A message that hands back a fillable stub makes it a prompt.
 */
import type { FoundLiteral } from "./scan.ts";
import type { ProseUnit } from "./prose.ts";
import { CLAIMS } from "./claims/index.ts";

function claimIds(): string {
  return Object.keys(CLAIMS).sort().join("\n    ");
}

export function unregisteredLiteral(found: FoundLiteral): string {
  const suggested = found.declName ?? "SOME_NAME";
  const param = `${found.module.replace(/^src\//, "").replace(/\.ts$/, "")}/${suggested
    .toLowerCase()
    .replace(/_/g, "-")}`;
  return `${found.module}:${found.line}:${found.column} — unregistered number ${found.value}

  in: ${found.enclosing}

Every number in the parameter surface must be a named export with a binding.
Pick one:

  1. It is pedagogy. Name it, then add to src/evidence/bindings/:

       ${JSON.stringify(param)}: {
         param: ${JSON.stringify(param)},
         target: { kind: "const", module: ${JSON.stringify(found.module)}, exportName: "${suggested.toUpperCase()}" },
         value: ${found.value},
         provenance: { kind: "conventional",
                       implementation: "<where this number came from>",
                       version: "<which version of it>",
                       caveat: "<why it has no published derivation>",
                       switchWhen: "<what evidence would replace it>" },
         claims: ["<a sort: 'practice' claim>"],
       },

     ...and declare ${JSON.stringify(param)} in src/evidence/params.ts, or the
     registry will not compile.

  2. It is not pedagogy — an index, a unit conversion, an interface constant, a
     tool-protocol rule, an operational budget. Use
     { kind: "technical", forcedBy, rationale }. It may carry no claim.

  3. You do not know yet. Use { kind: "unsourced", rationale, openQuestion }
     AND add the param to UNSOURCED in src/evidence/ratchet.ts. That list is
     closed: the test fails if it grows without being edited.

  Kinds and what each one requires: src/evidence/types.ts
  Known claim ids:
    ${claimIds()}`;
}

export function unregisteredExport(module: string, name: string, value: number | number[]): string {
  return `${module} exports ${name} = ${JSON.stringify(value)} with no binding.

An exported number in the scan surface is a decision someone made. Bind it in
src/evidence/bindings/ and declare its id in src/evidence/params.ts, or — if it
genuinely does not influence learning — bind it { kind: "technical", forcedBy,
rationale } so the exemption is on the record instead of in someone's head.

  Kinds and what each one requires: src/evidence/types.ts`;
}

export function unboundProseUnit(unit: ProseUnit): string {
  return `${unit.file}:${unit.line} — normative rule with no binding

  ${unit.text}

Everything the tutor is TOLD is pedagogy, whether or not it is a number. Add to
src/evidence/bindings/prose.ts and declare the id in src/evidence/params.ts:

  ${JSON.stringify(unit.id)}: {
    param: ${JSON.stringify(unit.id)},
    target: { kind: "prose", file: ${JSON.stringify(unit.file)}, unit: ${JSON.stringify(unit.id)},
              quote: ${JSON.stringify(unit.text)} },
    provenance: { kind: "entailed", rationale: "<how the cited claims produce this rule>" },
    claims: ["<claim id>"],
  },

If no evidence entails it, say so with { kind: "unsourced", rationale,
openQuestion } and add it to the ratchet — that is a real answer, and a more
useful one than a citation that does not fit.

  Known claim ids:
    ${claimIds()}`;
}

export function proseDrift(param: string, file: string, quote: string): string {
  return `${param} — quoted rule no longer appears in ${file}

  looked for: ${quote}

The prose was reworded, moved, or deleted while its provenance stayed behind.
Either restore the wording, or update the quote in src/evidence/bindings/prose.ts
AFTER checking the cited claims still support what the rule now says. The second
half is the point: a reword can quietly change what is being asserted.

If the rule's opening words changed, its id changed too (ids are heading plus the
first six words) — rename the param in src/evidence/params.ts to match.`;
}

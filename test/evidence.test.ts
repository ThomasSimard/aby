/**
 * The evidence gate.
 *
 * Everything in `src/evidence/` describes aby; this file is what makes the
 * description binding. It is pure plus `readFileSync` — no API key, no network, no
 * LanceDB, no `dot`, no python — so it stays in the low milliseconds. That is a
 * requirement, not a nicety: this is the check that must never be worth skipping.
 *
 * Note the division of labour with `pnpm check`. Referential integrity is a COMPILE
 * error: `params.ts` declares the parameter ids, `bindings/index.ts` is checked
 * against `{ [K in ParamId]: Binding<K> }`, and paper and claim ids are `keyof
 * typeof` unions. A dangling reference, a missing binding or a key that disagrees
 * with its own `param` never reaches this file. What is left here is everything the
 * type system cannot see: whether the numbers still agree with the code, whether a
 * provenance kind has actually earned itself, and whether the prose still says what
 * it was cited as saying.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { Binding, Claim, Paper, ProseNumber } from "../src/evidence/types.ts";
import type { ParamId } from "../src/evidence/params.ts";
import { PAPERS, PAPER_GROUPS } from "../src/evidence/papers/index.ts";
import { CLAIMS, CLAIM_GROUPS } from "../src/evidence/claims/index.ts";
import { BINDINGS, BINDING_GROUPS, allBindings } from "../src/evidence/bindings/index.ts";
import { restsOnPaper } from "../src/evidence/index.ts";
import { CONVENTIONAL, MAX_UNSOURCED, UNSOURCED } from "../src/evidence/ratchet.ts";
import { DERIVATIONS, runDerivation } from "../src/evidence/derive.ts";
import {
  EXPORT_SCAN,
  LITERAL_SCAN,
  NEUTRAL,
  RUNTIME_ROOTS,
} from "../src/evidence/surface.ts";
import {
  scanEvidenceImports,
  scanExportedNumbers,
  scanNumericLiterals,
} from "../src/evidence/scan.ts";
import {
  containsQuote,
  extractNormativeUnits,
  normalise,
  numbersIn,
  slugOf,
} from "../src/evidence/prose.ts";
import { DEFERRED_SOURCES, PROSE_SOURCES } from "../src/evidence/bindings/prose-sources.ts";
import {
  proseDrift,
  unboundProseUnit,
  unregisteredExport,
  unregisteredLiteral,
} from "../src/evidence/messages.ts";

const bindings = allBindings();
const byParam = BINDINGS as Record<ParamId, Binding>;
const read = (p: string): string => readFileSync(p, "utf8");

/** Resolve a bound endpoint or derivation input to a number. */
function resolveInput(input: { param: ParamId } | { paper: { paper: string; finding?: string } } | { literal: number; forcedBy: string }): number {
  if ("param" in input) {
    const v = byParam[input.param].value;
    assert.equal(typeof v, "number", `${input.param} is used as an input but has no scalar value`);
    return v as number;
  }
  if ("literal" in input) return input.literal;
  const ref = input.paper;
  assert.ok(ref.finding, `paper input ${ref.paper} used as a number must name a finding`);
  const f = (PAPERS[ref.paper as keyof typeof PAPERS] as Paper).findings.find((x) => x.id === ref.finding);
  assert.ok(f, `finding ${ref.finding} not found on ${ref.paper}`);
  return f.value;
}

// --------------------------------------------------------------- the corpus

describe("corpus integrity", () => {
  it("no paper id was silently overwritten by object spread", () => {
    // `{...A, ...B}` has no duplicate-key error: two files claiming one id would
    // leave one paper quietly replaced by the other, and every citation to it
    // would still resolve.
    const summed = PAPER_GROUPS.reduce((n, g) => n + Object.keys(g.group).length, 0);
    assert.equal(summed, Object.keys(PAPERS).length);
  });

  it("no claim id was silently overwritten", () => {
    const summed = CLAIM_GROUPS.reduce((n, g) => n + Object.keys(g.group).length, 0);
    assert.equal(summed, Object.keys(CLAIMS).length);
  });

  it("no binding was silently overwritten", () => {
    const summed = BINDING_GROUPS.reduce((n, g) => n + Object.keys(g.group).length, 0);
    assert.equal(summed, Object.keys(BINDINGS).length);
  });

  it("every cited finding exists on the paper it is cited from", () => {
    // The type system checks the paper id. It cannot check the finding id, which
    // is where a citation most easily rots: the paper stays, the number moves.
    for (const c of Object.values(CLAIMS) as Claim[]) {
      for (const ref of [...c.supportedBy, ...c.contradictedBy]) {
        if (ref.finding === undefined) continue;
        const p = PAPERS[ref.paper] as Paper;
        assert.ok(
          p.findings.some((f) => f.id === ref.finding),
          `claim ${c.id} cites ${ref.paper}#${ref.finding}, which does not exist. ` +
            `Findings on that paper: ${p.findings.map((f) => f.id).join(", ") || "(none)"}`,
        );
      }
    }
  });

  it("a claim that is not strong says why not", () => {
    for (const c of Object.values(CLAIMS) as Claim[]) {
      if (c.strength === "strong") continue;
      assert.ok(
        (c.strengthRationale ?? "").length > 0,
        `claim ${c.id} is "${c.strength}" with no strengthRationale. Unargued weakness ` +
          `reads as unargued strength once nobody remembers why.`,
      );
    }
  });

  it("every paper records at least one caveat", () => {
    // A paper with nothing wrong with it has not been read carefully.
    for (const p of Object.values(PAPERS) as Paper[]) {
      assert.ok(p.caveats.length > 0, `paper ${p.id} records no caveats`);
    }
  });
});

// ----------------------------------------------------- provenance is earned

describe("provenance kinds earn themselves", () => {
  it("reported values equal the finding they cite", () => {
    // The guard that makes "reported" untypeable: you cannot write a number next
    // to a citation, you must point at a numeric field of a paper record.
    for (const b of bindings) {
      if (b.provenance.kind !== "reported") continue;
      const ref = b.provenance.from;
      const p = PAPERS[ref.paper] as Paper;
      const f = p.findings.find((x) => x.id === ref.finding);
      assert.ok(f, `${b.param} cites ${ref.paper}#${ref.finding}, which does not exist`);
      assert.equal(
        b.value,
        f.value,
        `${b.param} claims to be reported as ${String(b.value)}, but ${ref.paper}#${ref.finding} reports ${f.value}`,
      );
    }
  });

  it("derived values actually recompute", () => {
    for (const b of bindings) {
      if (b.provenance.kind !== "derived") continue;
      const inputs = b.provenance.inputs.map(resolveInput);
      const got = runDerivation(b.provenance.fn, inputs);
      assert.ok(
        Math.abs(got - (b.value as number)) < 1e-12,
        `${b.param} says ${String(b.value)} but ${b.provenance.fn}(${inputs.join(", ")}) = ${got}`,
      );
    }
  });

  it("a literal input to a derivation says what forces it", () => {
    for (const b of bindings) {
      if (b.provenance.kind !== "derived") continue;
      for (const i of b.provenance.inputs) {
        if (!("literal" in i)) continue;
        assert.ok(
          i.forcedBy.trim().length > 0,
          `${b.param} feeds the bare literal ${i.literal} into a derivation with an empty forcedBy. ` +
            `That is the one escape hatch in the whole registry; it has to say what it is.`,
        );
      }
    }
  });

  it("bounded values sit inside endpoints that resolve", () => {
    for (const b of bindings) {
      if (b.provenance.kind !== "bounded") continue;
      const ends = [b.provenance.lo, b.provenance.hi].map((bound) => {
        const f = bound.from;
        if ("logical" in f) {
          return f.logical === "probability-ceiling" ? 1 : 0;
        }
        if ("derive" in f) return runDerivation(f.derive, f.inputs.map(resolveInput));
        if ("param" in f) return resolveInput({ param: f.param });
        return resolveInput({ paper: f.paper });
      });
      const [lo, hi] = ends as [number, number];
      const v = b.value as number;
      assert.ok(
        v >= lo && v <= hi,
        `${b.param} = ${v} is outside its own supported range [${lo}, ${hi}]`,
      );
    }
  });

  it("conventional bindings cite only practice claims and name what would retire them", () => {
    // The guard that stops an inherited constant borrowing a meta-analysis's
    // weight. "SM-2 is what everyone ships" is a true claim about practice and
    // carries no efficacy content; that is the only kind of support a convention
    // is allowed to rest on.
    for (const b of bindings) {
      if (b.provenance.kind !== "conventional") continue;
      assert.ok(b.claims.length > 0, `${b.param} is conventional but cites nothing`);
      for (const id of b.claims) {
        const c = CLAIMS[id] as Claim;
        assert.equal(
          c.sort,
          "practice",
          `${b.param} is conventional but cites ${id}, which is an empirical claim. ` +
            `A number inherited from an implementation may not be justified by evidence ` +
            `for a proposition it was not derived from.`,
        );
      }
      assert.ok(
        b.provenance.switchWhen.trim().length > 0,
        `${b.param} is conventional with no switchWhen — a convention with no retirement ` +
          `condition is just an unsourced number with a nicer label`,
      );
    }
  });

  it("technical, editorial and unsourced bindings carry no claims", () => {
    for (const b of bindings) {
      if (!["technical", "editorial", "unsourced"].includes(b.provenance.kind)) continue;
      assert.equal(
        b.claims.length,
        0,
        `${b.param} is ${b.provenance.kind} but cites ${b.claims.join(", ")}. ` +
          `These kinds mean "no evidential support is being claimed"; citing anything ` +
          `blurs exactly the line the registry exists to keep sharp.`,
      );
    }
  });

  it("every binding resting on a paper cites at least one claim", () => {
    // Deliberately not "every binding". `schedule/mastery-alpha` is bounded by an
    // interval both of whose endpoints trace to other parameters — that is
    // arithmetic, not evidence, and demanding a citation for it would manufacture
    // the false provenance this whole registry exists to prevent.
    for (const b of bindings) {
      if (!restsOnPaper(b)) continue;
      assert.ok(
        b.claims.length > 0,
        `${b.param} rests on published evidence but cites no claim`,
      );
    }
  });

  it("entailed is used only on prose, and the numeric kinds only on code", () => {
    for (const b of bindings) {
      const k = b.provenance.kind;
      if (k === "entailed") {
        assert.equal(b.target.kind, "prose", `${b.param} is entailed but is not prose`);
        assert.ok(b.claims.length > 0, `${b.param} is entailed but cites nothing`);
      }
      if (["reported", "derived", "bounded"].includes(k)) {
        assert.notEqual(
          b.target.kind,
          "prose",
          `${b.param} is ${k} on a prose target — a sentence has no value to compare`,
        );
      }
    }
  });

  it("every const and implied binding carries a value", () => {
    for (const b of bindings) {
      if (b.target.kind === "prose") continue;
      assert.notEqual(b.value, undefined, `${b.param} has no value to check against`);
    }
  });

  it("every implied parameter is referenced by something", () => {
    // An implied parameter has no code site, so nothing else would notice it going
    // stale. It earns its place only by being an input somewhere.
    const referenced = new Set<string>();
    for (const b of bindings) {
      const p = b.provenance;
      if (p.kind === "derived") {
        for (const i of p.inputs) if ("param" in i) referenced.add(i.param);
      }
      if (p.kind === "bounded") {
        for (const bound of [p.lo, p.hi]) {
          const f = bound.from;
          if ("param" in f) referenced.add(f.param);
          if ("derive" in f) for (const i of f.inputs) if ("param" in i) referenced.add(i.param);
        }
      }
      for (const n of b.numbers ?? []) if ("param" in n) referenced.add(n.param);
    }
    for (const b of bindings) {
      if (b.target.kind !== "implied") continue;
      assert.ok(
        referenced.has(b.param),
        `${b.param} is an implied parameter that nothing references. Either something ` +
          `should depend on it, or it is dead weight.`,
      );
    }
  });
});

// ------------------------------------------------------------------- drift

describe("the registry still matches the code", () => {
  it("every const binding equals the value the module exports", async () => {
    for (const b of bindings) {
      if (b.target.kind !== "const") continue;
      const mod = (await import(`../${b.target.module}`)) as Record<string, unknown>;
      const live = mod[b.target.exportName];
      assert.notEqual(
        live,
        undefined,
        `${b.param} points at ${b.target.module}#${b.target.exportName}, which is not exported`,
      );
      assert.deepEqual(
        live,
        b.value,
        `${b.param}: registry says ${JSON.stringify(b.value)}, ` +
          `${b.target.module} exports ${JSON.stringify(live)}`,
      );
    }
  });

  it("every exported number in the scan surface has a binding", () => {
    const bound = new Set(
      bindings
        .filter((b) => b.target.kind === "const")
        .map((b) => `${(b.target as { module: string }).module}#${(b.target as { exportName: string }).exportName}`),
    );
    for (const module of EXPORT_SCAN) {
      for (const e of scanExportedNumbers(module, read(module))) {
        assert.ok(bound.has(`${e.module}#${e.name}`), unregisteredExport(e.module, e.name, e.value));
      }
    }
  });

  it("every numeric literal in the strict surface belongs to a bound const", () => {
    // LITERAL_SCAN is empty in phase 0 — turning a module on requires its numbers
    // to be named first. The mechanism is exercised against a fixture below, so it
    // is proven working rather than merely present.
    const boundNames = new Set(
      bindings
        .filter((b) => b.target.kind === "const")
        .map((b) => (b.target as { exportName: string }).exportName),
    );
    for (const module of LITERAL_SCAN) {
      for (const lit of scanNumericLiterals(module, read(module))) {
        if (NEUTRAL.has(lit.value)) continue;
        assert.ok(lit.declName !== null && boundNames.has(lit.declName), unregisteredLiteral(lit));
      }
    }
  });
});

// ------------------------------------------------------------------ prose

describe("the prose still says what it was cited as saying", () => {
  const proseBindings = bindings.filter((b) => b.target.kind === "prose");

  it("every quoted rule still appears in its file", () => {
    for (const b of proseBindings) {
      const t = b.target as { file: string; quote: string };
      assert.ok(containsQuote(read(t.file), t.quote), proseDrift(b.param, t.file, t.quote));
    }
  });

  it("every normative unit is bound", () => {
    // This is the half that in-file citation comments could never do: it catches
    // pedagogy being ADDED. A new bullet under "Quizzing" fails here.
    for (const source of PROSE_SOURCES) {
      for (const unit of extractNormativeUnits(source, read(source.file))) {
        assert.ok(unit.id in BINDINGS, unboundProseUnit(unit));
      }
    }
  });

  it("every excluded heading says why", () => {
    for (const source of PROSE_SOURCES) {
      for (const ex of source.excluded) {
        assert.ok(
          ex.why.trim().length > 0,
          `${source.file} excludes "${ex.heading}" with no reason. A coverage guarantee ` +
            `whose exceptions you cannot enumerate is not a guarantee.`,
        );
      }
    }
  });

  it("every number in a quoted rule resolves to a parameter or a stated non-parameter", () => {
    // The rule that drags prompt numbers into the registry. "3-6 questions per
    // topic" and "8-20 nodes" decide as much about a session as MIN_EASE does, and
    // no scan over src/ would ever find them.
    for (const b of proseBindings) {
      const t = b.target as { quote: string };
      const found = numbersIn(t.quote);
      const declared: ProseNumber[] = [...(b.numbers ?? [])];
      assert.equal(
        declared.length,
        found.length,
        `${b.param} quotes ${found.length} number(s) [${found.join(", ")}] but declares ` +
          `${declared.length}. Every number the tutor is told is a parameter, or has to ` +
          `say why it is not.`,
      );
      for (const d of declared) {
        assert.ok(
          found.includes(d.n),
          `${b.param} declares the number ${d.n}, which is not in the quote`,
        );
        if ("param" in d) {
          assert.equal(
            byParam[d.param].value,
            d.n,
            `${b.param} says the prose number ${d.n} is ${d.param}, but that parameter is ` +
              `${String(byParam[d.param].value)}. The prompt and the registry disagree.`,
          );
        } else {
          assert.ok(d.notAParameter.trim().length > 0, `${b.param}: ${d.n} needs a reason`);
        }
      }
    }
  });
});

// ---------------------------------------------------------------- ratchet

describe("the debt can only shrink", () => {
  it("the unsourced set is exactly what the ratchet declares", () => {
    const actual = new Set<string>(bindings.filter((b) => b.provenance.kind === "unsourced").map((b) => b.param));
    const declared = new Set<string>(UNSOURCED);
    const added = [...actual].filter((p) => !declared.has(p)).sort();
    const retired = [...declared].filter((p) => !actual.has(p)).sort();

    assert.deepEqual(
      added,
      [],
      `new unsourced parameter(s): ${added.join(", ")}\n\n` +
        `Add them to UNSOURCED in src/evidence/ratchet.ts. Debt is allowed; debt ` +
        `nobody had to look at is not.`,
    );
    assert.deepEqual(
      retired,
      [],
      `no longer unsourced: ${retired.join(", ")}\n\n` +
        `Remove them from UNSOURCED in src/evidence/ratchet.ts and lower ` +
        `MAX_UNSOURCED to ${actual.size}.`,
    );
  });

  it("the conventional set is exactly what the ratchet declares", () => {
    const actual = [...new Set(bindings.filter((b) => b.provenance.kind === "conventional").map((b) => b.param))].sort();
    assert.deepEqual(actual, [...CONVENTIONAL].sort());
  });

  it("the ceiling is not above the count and not stale", () => {
    const n = UNSOURCED.length;
    assert.ok(n <= MAX_UNSOURCED, `${n} unsourced parameters exceeds MAX_UNSOURCED = ${MAX_UNSOURCED}`);
    assert.equal(
      n,
      MAX_UNSOURCED,
      `MAX_UNSOURCED is ${MAX_UNSOURCED} but only ${n} parameters are unsourced — ` +
        `lower it to ${n} so the ratchet keeps holding.`,
    );
  });

  it("every unsourced binding writes down the question", () => {
    for (const b of bindings) {
      if (b.provenance.kind !== "unsourced") continue;
      assert.ok(
        b.provenance.openQuestion.trim().length > 20,
        `${b.param} is unsourced with no real openQuestion. The list of unsourced ` +
          `parameters is meant to be readable as a research backlog; an entry with ` +
          `nothing to look up is just a shrug.`,
      );
    }
  });
});

// -------------------------------------------------------------- containment

describe("the corpus never reaches runtime", () => {
  it("nothing pi loads imports src/evidence", () => {
    // The guarantee that makes "maintainer only" true rather than intended. One
    // import would pull the whole bibliography into every session's context.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) {
          if (p !== join("src", "evidence")) walk(p);
          continue;
        }
        if (!p.endsWith(".ts")) continue;
        for (const spec of scanEvidenceImports(p, read(p))) offenders.push(`${p} imports ${spec}`);
      }
    };
    for (const root of RUNTIME_ROOTS) walk(root);
    assert.deepEqual(
      offenders,
      [],
      `${offenders.join("\n")}\n\nsrc/evidence/ is a test-time artifact. Importing it ` +
        `from anything pi loads puts twenty papers of prose into every session.`,
    );
  });
});

describe("deferred prose is a known gap, not a silent one", () => {
  it("every deferred source says why and still exists", () => {
    for (const d of DEFERRED_SOURCES) {
      assert.ok(d.why.trim().length > 20, `${d.file} is deferred with no real reason`);
      assert.doesNotThrow(() => read(d.file), `${d.file} is listed as deferred but is gone`);
    }
  });

  it("no file is both covered and deferred", () => {
    const covered = new Set(PROSE_SOURCES.map((s) => s.file));
    for (const d of DEFERRED_SOURCES) {
      assert.ok(!covered.has(d.file), `${d.file} is listed as both covered and deferred`);
    }
  });
});

// ------------------------------------------------------ the machinery itself

describe("scanner", () => {
  const src = [
    "export const A = 1.5;",
    "export const B = -0.25;",
    "export const LADDER = [1, 6] as const;",
    "const hidden = 42;",
    "export const NOT_A_NUMBER = 'x';",
    "type Bit = 0 | 1;",
    "export const MS = 86_400_000;",
    "function f(xs: number[]) { return xs[0] + 24 * 60; }",
  ].join("\n");

  it("finds exported numbers and numeric arrays, and ignores the rest", () => {
    const got = scanExportedNumbers("fixture.ts", src);
    assert.deepEqual(
      got.map((e) => [e.name, e.value]),
      [["A", 1.5], ["B", -0.25], ["LADDER", [1, 6]], ["MS", 86400000]],
    );
  });

  it("folds unary minus into one value rather than a literal and an operator", () => {
    const lits = scanNumericLiterals("fixture.ts", src);
    assert.ok(lits.some((l) => l.value === -0.25));
    assert.ok(!lits.some((l) => l.value === 0.25), "0.25 should have been folded into -0.25");
  });

  it("ignores numbers in type positions", () => {
    // `type Bit = 0 | 1` is a type, not a decision.
    const lits = scanNumericLiterals("only-types.ts", "type Bit = 0 | 1;\nexport const Z = 7;");
    assert.deepEqual(lits.map((l) => l.value), [7]);
  });

  it("reads numeric separators", () => {
    const lits = scanNumericLiterals("f.ts", "export const X = 20_000;");
    assert.deepEqual(lits.map((l) => l.value), [20000]);
  });

  it("names the enclosing declaration so the failure message can suggest an id", () => {
    const lit = scanNumericLiterals("f.ts", "const ease = 2.5 * 2;").find((l) => l.value === 2.5);
    assert.equal(lit?.declName, "ease");
  });

  it("spots evidence imports in every form", () => {
    assert.deepEqual(scanEvidenceImports("f.ts", 'import { X } from "./evidence/papers/index.ts";'), [
      "./evidence/papers/index.ts",
    ]);
    assert.deepEqual(scanEvidenceImports("f.ts", 'export { X } from "../evidence/index.ts";'), [
      "../evidence/index.ts",
    ]);
    assert.deepEqual(scanEvidenceImports("f.ts", 'const m = await import("../src/evidence/claims/index.ts");'), [
      "../src/evidence/claims/index.ts",
    ]);
    assert.deepEqual(scanEvidenceImports("f.ts", 'import { y } from "./graph.ts";'), []);
  });
});

describe("prose extraction", () => {
  const md = [
    "---",
    "name: x",
    "description: frontmatter is routing, never pedagogy",
    "---",
    "",
    "# Title",
    "",
    "## Assessing",
    "",
    "A plain paragraph that states a rule",
    "and wraps across a line.",
    "",
    "- **One thing.** Do it, then",
    "  wait for the answer.",
    "  - a sub-bullet that belongs to the one above",
    "- Another rule entirely.",
    "",
    "## Not normative",
    "",
    "- this must not be extracted",
  ].join("\n");

  const source = {
    file: "f.md",
    prefix: "t",
    normativeHeadings: ["Assessing"],
    excluded: [{ heading: "Not normative", why: "fixture" }],
  };

  it("joins wrapped lines and folds sub-bullets into their parent", () => {
    const units = extractNormativeUnits(source, md);
    assert.equal(units.length, 3);
    assert.equal(units[0]?.text, "A plain paragraph that states a rule and wraps across a line.");
    assert.equal(
      units[1]?.text,
      "One thing. Do it, then wait for the answer. a sub-bullet that belongs to the one above",
    );
    assert.equal(units[2]?.text, "Another rule entirely.");
  });

  it("takes paragraphs as well as bullets", () => {
    // SKILL.md states rules in bare paragraphs too; a bullets-only rule would leave
    // them silently uncovered, which is worse than not checking at all.
    assert.ok(extractNormativeUnits(source, md).some((u) => u.text.startsWith("A plain paragraph")));
  });

  it("ignores frontmatter and non-normative headings", () => {
    const units = extractNormativeUnits(source, md);
    assert.ok(!units.some((u) => u.text.includes("frontmatter")));
    assert.ok(!units.some((u) => u.text.includes("must not be extracted")));
  });

  it("survives rewrapping but not rewording", () => {
    const quote = "Do it, then wait for the answer.";
    assert.ok(containsQuote("Do it,\n  then wait\n  for the answer.", quote));
    assert.ok(containsQuote("Do it, then **wait** for the `answer`.", quote));
    assert.ok(!containsQuote("Do it, then wait for their answer.", quote));
  });

  it("keeps underscores, because they are tool names here and not italics", () => {
    assert.equal(normalise("call `aby_record_quiz` *every* time"), "call aby_record_quiz every time");
  });

  it("slugs from the leading words, so reordering bullets is free", () => {
    assert.equal(slugOf("**Stop when placed**, usually 3-6 questions per topic.", 6), "stop-when-placed-usually-36-questions");
  });

  it("finds the numbers a rule states, and not parts of words", () => {
    assert.deepEqual(numbersIn("usually 3-6 questions"), [3, 6], "a hyphen range is two numbers");
    assert.deepEqual(numbersIn("usually 3\u20136 questions"), [3, 6], "so is an en-dash range");
    assert.deepEqual(numbersIn("scores: 1.0 correct, ~0.5 partial, 0 wrong"), [1.0, 0.5, 0]);
    assert.deepEqual(numbersIn("call aby_record_quiz"), [], "digits inside identifiers are not quantities");
    assert.deepEqual(numbersIn("the SM-2 ladder and MiniLM-L6 embeddings"), [], "a hyphen after a letter is a name");
  });
});

describe("derivations", () => {
  it("the lapse boundary follows from the quality scale", () => {
    // Math.round(2.5) === 3 in JS, so the lowest score still reaching quality 3 is
    // 0.5 — not the 0.6 that grade.ts and SKILL.md both claim.
    assert.equal(DERIVATIONS["score-boundary-for-quality"](5, 3), 0.5);
  });

  it("the EMA interval for reaching a threshold in exactly k answers", () => {
    const lo = DERIVATIONS["ema-alpha-reaching-in"](0.8, 4);
    const hi = DERIVATIONS["ema-alpha-strictly-below-reaching-in"](0.8, 4);
    assert.ok(Math.abs(lo - 0.3312596950235780) < 1e-12);
    assert.ok(Math.abs(hi - 0.4151964523574269) < 1e-12);
  });

  it("refuses a derivation called with the wrong arity", () => {
    assert.throws(() => runDerivation("ema-alpha-reaching-in", [0.8]), /takes 2 input\(s\)/);
  });
});

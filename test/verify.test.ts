import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseVerdict,
  runCheck,
  summarizeVerdict,
  validateCheck,
  type Check,
} from "../src/verify.ts";

/**
 * The integration tests shell out to a real interpreter with sympy, the same way
 * graph.test.ts shells out to a real `dot`. ABY_PYTHON lets the suite run against
 * an interpreter that is not the one on PATH.
 */
const PYTHON = process.env.ABY_PYTHON ?? "python3";

// ------------------------------------------------------------------ pure

test("validateCheck rejects malformed checks with a usable message", () => {
  assert.throws(
    () => validateCheck({ kind: "equivalent", left: "", right: "1" }),
    /"left" must be a non-empty sympy expression/,
  );
  assert.throws(
    () => validateCheck({ kind: "solve", equation: "x-1", variable: "x", expected: [] }),
    /non-empty array of solutions/,
  );
  assert.throws(
    () =>
      validateCheck({
        kind: "evaluate",
        expr: "x",
        at: {},
        expected: "1",
        tol: 0,
      }),
    /"tol" must be a positive number/,
  );
  assert.throws(
    () => validateCheck({ kind: "nonsense" } as unknown as Check),
    /unknown check kind "nonsense".*equivalent, evaluate, solve/s,
  );
});

test("parseVerdict treats every unusable output as inconclusive, not as failure", () => {
  for (const output of ["", "   ", "not json at all", "{oops"]) {
    const verdict = parseVerdict("equivalent", output);
    assert.equal(verdict.inconclusive, true, `for ${JSON.stringify(output)}`);
    assert.equal(verdict.ok, false);
  }
});

test("parseVerdict reads the last line, so a stray warning does not poison a verdict", () => {
  const verdict = parseVerdict(
    "evaluate",
    'RuntimeWarning: something\n{"ok": true, "detail": "fine", "inconclusive": false, "computed": "2"}',
  );
  assert.equal(verdict.ok, true);
  assert.equal(verdict.computed, "2");
});

test("summarizeVerdict distinguishes unverified from wrong", () => {
  const base = { kind: "equivalent" as const, detail: "d" };
  assert.match(summarizeVerdict({ ...base, ok: true, inconclusive: false }), /^verified/);
  assert.match(summarizeVerdict({ ...base, ok: false, inconclusive: false }), /^WRONG/);
  // The distinction the whole module exists to preserve: an unproven claim must
  // never render as a confirmed one.
  assert.match(summarizeVerdict({ ...base, ok: false, inconclusive: true }), /^UNVERIFIED/);
});

// ----------------------------------------------------------- degradation

test("a missing interpreter is inconclusive, never a failed check", async () => {
  const verdict = await runCheck(
    { kind: "equivalent", left: "x", right: "x" },
    { python: "aby-no-such-interpreter" },
  );
  assert.equal(verdict.inconclusive, true);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /could not run/);
});

test("a check that overruns its timeout is killed and reported as inconclusive", async () => {
  const verdict = await runCheck(
    { kind: "equivalent", left: "x", right: "x" },
    { python: PYTHON, timeoutMs: 1 },
  );
  assert.equal(verdict.inconclusive, true);
  assert.match(verdict.detail, /did not finish within 1ms/);
});

// ----------------------------------------------------------- integration

test("equivalent proves a partial fraction expansion and catches a sign slip", async () => {
  const right = await runCheck(
    {
      kind: "equivalent",
      left: "1/(s**2 - 1)",
      right: "(1/2)/(s-1) - (1/2)/(s+1)",
    },
    { python: PYTHON },
  );
  assert.equal(right.ok, true, right.detail);
  assert.equal(right.inconclusive, false);

  const wrong = await runCheck(
    {
      kind: "equivalent",
      left: "1/(s**2 - 1)",
      right: "(1/2)/(s-1) + (1/2)/(s+1)",
    },
    { python: PYTHON },
  );
  assert.equal(wrong.ok, false, wrong.detail);
  assert.equal(wrong.inconclusive, false, "a numeric counterexample is proof, not a maybe");
  assert.match(wrong.detail, /NOT equivalent/);
});

test("equivalent survives sympy keyword arguments in an expression", async () => {
  // The naive 'split on =' equation parser truncated this into a syntax error.
  const verdict = await runCheck(
    {
      kind: "equivalent",
      left: "laplace_transform(exp(-3*t)*Heaviside(t), t, s, noconds=True)",
      right: "1/(s+3)",
    },
    { python: PYTHON },
  );
  assert.equal(verdict.ok, true, verdict.detail);
});

test("evaluate catches the critical-angle complement slip", async () => {
  const right = await runCheck(
    { kind: "evaluate", expr: "deg(asin(1/1.5))", at: {}, expected: "41.81", tol: 1e-3 },
    { python: PYTHON },
  );
  assert.equal(right.ok, true, right.detail);

  const wrong = await runCheck(
    { kind: "evaluate", expr: "deg(asin(1/1.5))", at: {}, expected: "48.6", tol: 1e-3 },
    { python: PYTHON },
  );
  assert.equal(wrong.ok, false);
  assert.equal(wrong.inconclusive, false);
});

test("evaluate refuses to guess at an unbound symbol", async () => {
  const verdict = await runCheck(
    { kind: "evaluate", expr: "-d_i/d_o", at: { d_i: 15 }, expected: "-0.5" },
    { python: PYTHON },
  );
  assert.equal(verdict.inconclusive, true);
  assert.match(verdict.detail, /no value given for d_o/);
});

test("solve compares solution sets up to algebraic form, not spelling", async () => {
  const verdict = await runCheck(
    {
      kind: "solve",
      equation: "2*x**2 - 1",
      variable: "x",
      // sympy returns +-sqrt(2)/2; these are the same numbers written differently.
      expected: ["1/sqrt(2)", "-sqrt(2)/2"],
    },
    { python: PYTHON },
  );
  assert.equal(verdict.ok, true, verdict.detail);
});

test("solve checks the mirror equation and names the disagreement", async () => {
  const right = await runCheck(
    { kind: "solve", equation: "1/30 + 1/d_i = 1/10", variable: "d_i", expected: ["15"] },
    { python: PYTHON },
  );
  assert.equal(right.ok, true, right.detail);

  const wrong = await runCheck(
    { kind: "solve", equation: "1/30 + 1/d_i = 1/10", variable: "d_i", expected: ["20"] },
    { python: PYTHON },
  );
  assert.equal(wrong.ok, false);
  assert.match(wrong.detail, /expected but not found: 20/);
  assert.match(wrong.detail, /found but not expected: 15/);
});

test("an unparseable expression is inconclusive and says what good input looks like", async () => {
  const verdict = await runCheck(
    { kind: "equivalent", left: "1/(((", right: "1" },
    { python: PYTHON },
  );
  assert.equal(verdict.inconclusive, true);
  assert.match(verdict.detail, /could not parse left/);
});

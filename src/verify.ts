/**
 * Machine-checking what the tutor asserts, before the learner sees it.
 *
 * The rest of aby is rigorous arithmetic (SM-2, mastery EMA, DAG status) over one
 * number the model invents: the `score` handed to aby_record_quiz, graded against an
 * `answerKey` the same model wrote in the same turn. This module is the first
 * ground-truth channel — it lets the tutor discharge a claim against a CAS instead of
 * against its own confidence.
 *
 * Two deliberate constraints:
 *
 *   - **Advisory, never blocking.** A missing interpreter, an unparseable expression
 *     or a simplify sympy cannot close all resolve to `inconclusive`, not to failure.
 *     A hard gate would turn every checker hiccup into a stalled tutoring session, so
 *     this follows `graphicsAvailable()` and the try/catch around `renderDot`: degrade,
 *     report why, carry on.
 *   - **Three-way verdicts.** `ok: false` with `inconclusive: true` means "not checked",
 *     which is a different claim from "checked and wrong". Collapsing the two would let
 *     an unproven equivalence be reported as verified.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

/** Fails a check that hangs — a runaway simplify must not wedge the session. */
export const CHECK_TIMEOUT_MS = 20_000;

export type Check =
  | { kind: "equivalent"; left: string; right: string }
  | {
      kind: "evaluate";
      expr: string;
      at: Record<string, number | string>;
      expected: number | string;
      tol?: number;
    }
  | { kind: "solve"; equation: string; variable: string; expected: string[] };

export type CheckKind = Check["kind"];

export type Verdict = {
  kind: CheckKind;
  /** True only when the checker positively established the claim. */
  ok: boolean;
  /** The checker could not reach a conclusion; `ok` is meaningless. */
  inconclusive: boolean;
  /** Prose for the model: what was computed and, on failure, where it diverged. */
  detail: string;
  /** What the CAS actually produced, when there was such a thing. */
  computed?: string;
};

export const CHECK_KINDS: CheckKind[] = ["equivalent", "evaluate", "solve"];

/**
 * Reject a malformed check with a message the model can act on.
 *
 * Same contract as the roadmap tools: an error is a prompt, so it says what was
 * wrong *and* what a good value looks like.
 */
export function validateCheck(check: Check): void {
  const nonEmpty = (value: unknown, field: string): string => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`"${field}" must be a non-empty sympy expression.`);
    }
    return value;
  };

  switch (check.kind) {
    case "equivalent":
      nonEmpty(check.left, "left");
      nonEmpty(check.right, "right");
      return;

    case "evaluate": {
      nonEmpty(check.expr, "expr");
      if (check.expected === undefined || check.expected === null) {
        throw new Error(`"expected" is required for an evaluate check.`);
      }
      if (check.at === null || typeof check.at !== "object") {
        throw new Error(
          `"at" must be an object binding every free symbol, e.g. {"d_o": 30, "f": 10}.`,
        );
      }
      if (check.tol !== undefined && !(check.tol > 0)) {
        throw new Error(`"tol" must be a positive number when given.`);
      }
      return;
    }

    case "solve": {
      nonEmpty(check.equation, "equation");
      nonEmpty(check.variable, "variable");
      if (!Array.isArray(check.expected) || check.expected.length === 0) {
        throw new Error(
          `"expected" must be a non-empty array of solutions, e.g. ["2", "-2"].`,
        );
      }
      check.expected.forEach((sol, i) => nonEmpty(sol, `expected[${i}]`));
      return;
    }

    default: {
      const kind = (check as { kind?: unknown }).kind;
      throw new Error(
        `unknown check kind ${JSON.stringify(kind)}. Known kinds: ${CHECK_KINDS.join(", ")}.`,
      );
    }
  }
}

/**
 * Turn the driver's stdout into a Verdict.
 *
 * Split out from the spawn so the parsing — including every way the driver can
 * disappoint us — is testable without a Python interpreter.
 */
export function parseVerdict(kind: CheckKind, stdout: string): Verdict {
  const text = stdout.trim();
  if (text.length === 0) {
    return {
      kind,
      ok: false,
      inconclusive: true,
      detail: "the checker produced no output",
    };
  }

  // The driver prints exactly one JSON object, but a stray warning on stdout would
  // otherwise poison an otherwise good verdict.
  const line = text.slice(text.lastIndexOf("\n") + 1);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return {
      kind,
      ok: false,
      inconclusive: true,
      detail: `unreadable checker output: ${text.slice(0, 200)}`,
    };
  }

  const computed = raw.computed;
  return {
    kind,
    ok: raw.ok === true,
    inconclusive: raw.inconclusive === true,
    detail: typeof raw.detail === "string" ? raw.detail : "(no detail)",
    computed: typeof computed === "string" ? computed : undefined,
  };
}

/** One line for a tool result or a transcript entry. */
export function summarizeVerdict(verdict: Verdict): string {
  const label = verdict.inconclusive
    ? "UNVERIFIED"
    : verdict.ok
      ? "verified"
      : "WRONG";
  return `${label} (${verdict.kind}): ${verdict.detail}`;
}

const DRIVER = join(import.meta.dirname, "checkers", "cas.py");

/**
 * Run one check through the CAS driver.
 *
 * Follows `renderDot`'s shape — argv array so there is no shell to inject into,
 * payload on stdin rather than a temp file, stderr captured and surfaced — and adds
 * the two things `dot` never needed: a timeout, and the turn's AbortSignal, because
 * a CAS call is seconds rather than milliseconds and must die with a cancelled turn.
 */
export async function runCheck(
  check: Check,
  options: { signal?: AbortSignal; timeoutMs?: number; python?: string } = {},
): Promise<Verdict> {
  validateCheck(check);

  const python = options.python ?? process.env.ABY_PYTHON ?? "python3";
  const timeoutMs = options.timeoutMs ?? CHECK_TIMEOUT_MS;

  return await new Promise<Verdict>((resolve) => {
    const child = spawn(python, [DRIVER], {
      signal: options.signal,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (verdict: Verdict) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(verdict);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({
        kind: check.kind,
        ok: false,
        inconclusive: true,
        detail: `the checker did not finish within ${timeoutMs}ms; simplify the expression or check a numeric case instead`,
      });
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });

    // ENOENT here means no interpreter at all. Inconclusive, not wrong: the tutor
    // should say the claim is unchecked, not that it is false.
    child.on("error", (err) => {
      finish({
        kind: check.kind,
        ok: false,
        inconclusive: true,
        detail: `could not run '${python}' (is the nix dev shell active?): ${err.message}`,
      });
    });

    child.on("close", (code) => {
      if (code === 0) return finish(parseVerdict(check.kind, stdout));
      const reason = stderr.trim().slice(0, 300);
      finish({
        kind: check.kind,
        ok: false,
        inconclusive: true,
        detail: reason
          ? `the checker exited ${code}: ${reason}`
          : `the checker exited ${code}`,
      });
    });

    child.stdin.on("error", () => {
      // The child died before reading stdin; `close` already reports the reason.
    });
    child.stdin.end(JSON.stringify(check));
  });
}

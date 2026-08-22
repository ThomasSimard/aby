/**
 * aby_check — discharge a claim against a CAS before teaching it.
 *
 * A separate extension rather than another tool in aby.ts, for the reason
 * extensions/mermaid.ts is separate: it has its own concern and its own failure mode,
 * and pi loads every .ts directly under extensions/ without any registration.
 *
 * It deliberately sets no widget. `ctx.ui.setWidget` is keyed, and the tutor's chrome
 * owns the key "aby"; a second writer would clobber the mastery strip above the editor.
 * The `aby_` name prefix is kept on purpose so aby.ts's `tool_execution_end` hook still
 * refreshes that chrome after a call.
 */

import type {
  AgentToolResult,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
  runCheck,
  summarizeVerdict,
  type Check,
  type Verdict,
} from "../src/verify.ts";

/** Build the internal Check from the flat tool schema, rejecting what does not fit. */
function toCheck(params: {
  kind: string;
  left?: string;
  right?: string;
  expr?: string;
  at?: Record<string, number | string>;
  expected?: string;
  tol?: number;
  equation?: string;
  variable?: string;
  solutions?: string[];
}): Check {
  switch (params.kind) {
    case "equivalent":
      if (!params.left || !params.right) {
        throw new Error(
          `an "equivalent" check needs both "left" and "right", e.g. left "1/(s**2-1)", right "(1/2)/(s-1) - (1/2)/(s+1)".`,
        );
      }
      return { kind: "equivalent", left: params.left, right: params.right };

    case "evaluate":
      if (!params.expr || params.expected === undefined) {
        throw new Error(
          `an "evaluate" check needs "expr" and "expected", e.g. expr "deg(asin(1/1.5))", expected "41.81".`,
        );
      }
      return {
        kind: "evaluate",
        expr: params.expr,
        at: params.at ?? {},
        expected: params.expected,
        ...(params.tol === undefined ? {} : { tol: params.tol }),
      };

    case "solve":
      if (!params.equation || !params.variable || !params.solutions?.length) {
        throw new Error(
          `a "solve" check needs "equation", "variable" and "solutions", e.g. equation "1/30 + 1/d_i = 1/10", variable "d_i", solutions ["15"].`,
        );
      }
      return {
        kind: "solve",
        equation: params.equation,
        variable: params.variable,
        expected: params.solutions,
      };

    default:
      throw new Error(
        `unknown check kind ${JSON.stringify(params.kind)}. Use equivalent, evaluate or solve.`,
      );
  }
}

function ok(verdict: Verdict): AgentToolResult<Verdict> {
  return {
    content: [{ type: "text", text: summarizeVerdict(verdict) }],
    details: verdict,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "aby_check",
    label: "Check with CAS",
    description:
      "Verify a mathematical claim with a computer algebra system before you teach it or grade against it. " +
      "Three kinds: 'equivalent' proves two expressions are the same (partial fractions, transform round-trips, identities); " +
      "'evaluate' checks a numeric result (a critical angle, an image distance); " +
      "'solve' checks that an equation's solution set is what you claim. " +
      "Expressions are sympy syntax. Returns verified, WRONG, or UNVERIFIED — UNVERIFIED means the checker could not decide, which is not the same as correct.",
    promptSnippet:
      "Check an algebraic identity, numeric value or solution set with a CAS",
    promptGuidelines: [
      "Before teaching a worked example or writing a quiz answer key with a mathematical result in it, discharge the key step with aby_check. The answer key is otherwise graded by the same model that wrote it.",
      "Treat an UNVERIFIED verdict as unchecked, never as confirmation. Say so plainly rather than implying the result was verified.",
      "If aby_check reports WRONG, fix the claim before showing it to the learner — do not teach it with a caveat.",
    ],
    parameters: Type.Object({
      kind: Type.Union(
        [
          Type.Literal("equivalent"),
          Type.Literal("evaluate"),
          Type.Literal("solve"),
        ],
        { description: "Which kind of check to run." },
      ),
      left: Type.Optional(
        Type.String({
          description:
            "equivalent: the first expression, e.g. '1/(s**2 - 1)'. May be an 'lhs = rhs' equation.",
        }),
      ),
      right: Type.Optional(
        Type.String({
          description:
            "equivalent: the expression it should equal, e.g. '(1/2)/(s-1) - (1/2)/(s+1)'.",
        }),
      ),
      expr: Type.Optional(
        Type.String({
          description:
            "evaluate: the expression to compute, e.g. 'deg(asin(1/1.5))' or '-d_i/d_o'.",
        }),
      ),
      at: Type.Optional(
        Type.Record(Type.String(), Type.Union([Type.Number(), Type.String()]), {
          description:
            "evaluate: a value for every free symbol, e.g. {'d_i': 15, 'd_o': 30}.",
        }),
      ),
      expected: Type.Optional(
        Type.String({
          description:
            "evaluate: the value you claim it takes, e.g. '41.81'. Exact forms like 'sqrt(2)/2' are fine.",
        }),
      ),
      tol: Type.Optional(
        Type.Number({
          description:
            "evaluate: relative tolerance, default 1e-6. Raise it when comparing against a rounded figure.",
        }),
      ),
      equation: Type.Optional(
        Type.String({
          description:
            "solve: the equation, e.g. '1/30 + 1/d_i = 1/10'. A bare expression is taken as '= 0'.",
        }),
      ),
      variable: Type.Optional(
        Type.String({ description: "solve: the symbol to solve for, e.g. 'd_i'." }),
      ),
      solutions: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "solve: every solution you claim, e.g. ['15'] or ['sqrt(2)/2', '-sqrt(2)/2']. Compared as a set, so ordering and equivalent forms do not matter.",
        }),
      ),
    }),
    async execute(_id, params, signal) {
      return ok(await runCheck(toCheck(params), { signal }));
    },
    renderResult: (result, _options, theme, context) => {
      const verdict = result.details;
      if (context.isError || !verdict) {
        const text = result.content
          ?.map((c) => (c.type === "text" ? c.text : ""))
          .join("");
        return new Text(theme.fg("error", text || "check failed"), 0, 0);
      }

      const [label, colour] = verdict.inconclusive
        ? ["UNVERIFIED", "warning" as const]
        : verdict.ok
          ? ["verified", "success" as const]
          : ["WRONG", "error" as const];

      const box = new Box(0, 0);
      box.addChild(
        new Text(
          `${theme.fg(colour, theme.bold(label))} ${theme.fg("muted", verdict.kind)}`,
          0,
          0,
        ),
      );
      box.addChild(new Text(theme.fg("dim", verdict.detail), 0, 0));
      return box;
    },
  });
}

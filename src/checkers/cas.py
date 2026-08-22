"""
The CAS checker's driver: one JSON request on stdin, one JSON verdict on stdout.

Kept as a real file rather than a `python3 -c` string so it can be read and linted
like the rest of the checker. It is invoked by src/verify.ts, which owns the
spawn, the timeout and the abort signal.

Three-way answer on purpose. `simplify(a - b) != 0` does NOT prove two expressions
differ -- sympy simply may not have found the reduction -- so a failed simplify
falls through to a numeric probe at fixed sample points:

  probe disagrees  -> "wrong", and we can say where
  probe agrees     -> "inconclusive", not "correct"

Reporting an unproven equivalence as verified would be exactly the laundering the
checker exists to prevent.
"""

import json
import sys

# Fixed, not random, so a verdict is reproducible across runs. Chosen to avoid the
# usual poles (0, 1, -1) and the branch points of log/sqrt.
PROBE_POINTS = [
    "2/3", "7/5", "-11/4", "13/7", "5/2", "-3/8", "17/6",
]

# Relative tolerance for numeric comparison. Loose enough for float round-trips
# through evalf, tight enough that a genuine algebra slip never slips past.
REL_TOL = 1e-9


def emit(ok, detail, inconclusive=False, computed=None):
    json.dump(
        {
            "ok": bool(ok),
            "detail": detail,
            "inconclusive": bool(inconclusive),
            "computed": computed,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    sys.exit(0)


def parse(sp, text, label):
    try:
        return sp.sympify(text)
    except Exception as err:  # sympify raises a wide variety of parse errors
        emit(
            False,
            f"could not parse {label} ({text!r}): {err}. "
            f"Write it as a sympy expression, e.g. '1/(s**2 + 4)' or 'sin(x)**2'.",
            inconclusive=True,
        )


def split_equation(text):
    """
    Find a top-level `=`, or None.

    Depth-aware because sympy expressions carry keyword arguments -- splitting
    `laplace_transform(f, t, s, noconds=True)` on its first `=` truncates the call
    into a parse error. Comparison operators are stepped over for the same reason.
    """
    depth = 0
    for i, ch in enumerate(text):
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "=" and depth == 0:
            if text[i - 1 : i] in ("=", "<", ">", "!") or text[i + 1 : i + 2] == "=":
                continue
            return text[:i], text[i + 1 :]
    return None


def as_expression(sp, text, label):
    """Accept either an expression or an `lhs = rhs` equation, as lhs - rhs."""
    parts = split_equation(text)
    if parts is None:
        return parse(sp, text, label)
    return parse(sp, parts[0], label) - parse(sp, parts[1], label)


def probe(sp, expr):
    """
    Evaluate expr at fixed points with every free symbol bound.

    Returns (verdict, detail) where verdict is True (vanishes everywhere tried),
    False (definitely nonzero somewhere) or None (never evaluable -- poles only).
    """
    symbols = sorted(expr.free_symbols, key=str)
    evaluated = 0

    for point in PROBE_POINTS:
        value = sp.Rational(point)
        # Stagger the substitutions so f(x, y) is not only probed on the diagonal.
        binding = {s: value + sp.Rational(i, 11) for i, s in enumerate(symbols)}
        try:
            result = complex(sp.N(expr.subs(binding), 30))
        except Exception:
            continue  # a pole or an unevaluated integral at this point
        if result != result or abs(result) == float("inf"):
            continue
        evaluated += 1
        if abs(result) > REL_TOL:
            shown = ", ".join(f"{s}={binding[s]}" for s in symbols) or "no free symbols"
            return False, f"differ at {shown}: difference = {result:.6g}"

    if evaluated == 0:
        return None, "could not evaluate at any sample point"
    return True, f"agree numerically at {evaluated} sample point(s)"


def check_equivalent(sp, req):
    left = as_expression(sp, req["left"], "left")
    right = as_expression(sp, req["right"], "right")
    difference = sp.simplify(left - right)

    if difference == 0:
        return emit(True, "equivalent: simplify(left - right) == 0", computed="0")

    agrees, detail = probe(sp, difference)
    if agrees is False:
        return emit(False, f"NOT equivalent -- {detail}", computed=str(difference))
    if agrees is None:
        return emit(
            False,
            f"could not decide: simplify left {sp.srepr(difference)[:120]} and {detail}",
            inconclusive=True,
            computed=str(difference),
        )
    return emit(
        False,
        f"probably equivalent but unproven: simplify left a nonzero form, "
        f"though the two {detail}. Treat as unverified.",
        inconclusive=True,
        computed=str(difference),
    )


def check_evaluate(sp, req):
    expr = as_expression(sp, req["expr"], "expr")
    bindings = {sp.Symbol(name): sp.sympify(value) for name, value in req.get("at", {}).items()}

    missing = sorted(str(s) for s in expr.free_symbols if s not in bindings)
    if missing:
        return emit(
            False,
            f"cannot evaluate: no value given for {', '.join(missing)}. "
            f"Supply every free symbol in `at`.",
            inconclusive=True,
        )

    try:
        actual = complex(sp.N(expr.subs(bindings), 30))
    except Exception as err:
        return emit(False, f"could not evaluate: {err}", inconclusive=True)

    expected = complex(sp.N(sp.sympify(req["expected"]), 30))
    tolerance = float(req.get("tol", 1e-6))
    scale = max(abs(expected), 1.0)
    delta = abs(actual - expected)

    real = actual.real if abs(actual.imag) < REL_TOL else actual
    if delta <= tolerance * scale:
        return emit(True, f"evaluates to {real:.10g}, as expected", computed=str(real))
    return emit(
        False,
        f"evaluates to {real:.10g}, but {expected.real:.10g} was expected "
        f"(off by {delta:.6g})",
        computed=str(real),
    )


def check_solve(sp, req):
    equation = as_expression(sp, req["equation"], "equation")
    variable = sp.Symbol(req["variable"])

    try:
        roots = sp.solve(equation, variable, dict=False)
    except Exception as err:
        return emit(False, f"sympy could not solve for {variable}: {err}", inconclusive=True)

    found = {sp.simplify(r) for r in roots}
    expected = {sp.simplify(parse(sp, e, "expected solution")) for e in req["expected"]}

    shown = ", ".join(sorted(str(r) for r in found)) or "(no solutions)"

    # Set equality on sympy objects is structural, so `sqrt(2)/2` and `1/sqrt(2)`
    # would count as different roots. Compare pairwise through simplify instead.
    unmatched = [e for e in expected if not any(sp.simplify(e - f) == 0 for f in found)]
    extra = [f for f in found if not any(sp.simplify(e - f) == 0 for e in expected)]
    if not unmatched and not extra:
        return emit(True, f"solutions match: {shown}", computed=shown)

    parts = []
    if unmatched:
        parts.append(f"expected but not found: {', '.join(sorted(str(u) for u in unmatched))}")
    if extra:
        parts.append(f"found but not expected: {', '.join(sorted(str(x) for x in extra))}")
    return emit(False, f"solution sets differ -- {'; '.join(parts)}", computed=shown)


HANDLERS = {
    "equivalent": check_equivalent,
    "evaluate": check_evaluate,
    "solve": check_solve,
}


def main():
    try:
        request = json.load(sys.stdin)
    except Exception as err:
        emit(False, f"malformed request: {err}", inconclusive=True)

    try:
        import sympy
    except ImportError:
        emit(
            False,
            "sympy is not installed, so nothing could be checked "
            "(is the nix dev shell active?)",
            inconclusive=True,
        )

    handler = HANDLERS.get(request.get("kind"))
    if handler is None:
        emit(False, f"unknown check kind {request.get('kind')!r}", inconclusive=True)

    try:
        handler(sympy, request)
    except SystemExit:
        raise
    except Exception as err:
        emit(False, f"checker crashed: {type(err).__name__}: {err}", inconclusive=True)


if __name__ == "__main__":
    main()

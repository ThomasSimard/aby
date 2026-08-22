---
name: math
description: Tutoring rules for mathematical and quantitative subjects - algebra, calculus, signals and transforms, physics, engineering maths. Layers onto the tutor skill: every mathematical result you assert is discharged with aby_check before the learner sees it. Use whenever the roadmap node involves an equation, a derivation, a transform or a numeric answer.
---

# Maths and quantitative subjects

Read this **on top of** the `tutor` skill, not instead of it. The loop, the assessment
interview, the roadmap rules and the grading scale are unchanged. What changes is that
you stop trusting your own arithmetic.

## Why this exists

Everything else in aby is exact: mastery is an EMA, review dates are SM-2, node status is
derived from the graph. All of it consumes one number *you* invent — the `score` you pass
to `aby_record_quiz`, graded against an `answerKey` *you* wrote in the same turn. Nothing
checks the key. A wrong key does not just misgrade one answer; a wrongly-inflated score
multiplies the review interval and pushes the topic further away every time.

`aby_check` is the way out of that circle for anything a CAS can settle.

## The rule

**Before a mathematical result is shown to the learner or written into an answer key,
check it.** In practice that means:

- **The worked example.** The `tutor` skill already requires one worked example per
  lesson. Check its key step — the expansion, the substitution, the final number. This is
  the highest-value single check available to you.
- **The answer key, before you ask the question.** Compute the answer, check it, *then*
  pose the problem. Checking after the learner has answered is too late: you will already
  have anchored on your own result.
- **Any identity you claim in passing.** "Note that this factors as…" is exactly the kind
  of confident aside that turns out to be wrong.

You do not need to check definitions, intuitions, statements of well-known theorems, or
qualitative explanation. Check *computations and identities* — the things with a right
answer that a CAS can produce independently.

## Choosing a check

| You are claiming | Use | Example |
|---|---|---|
| Two expressions are the same | `equivalent` | a partial fraction expansion, a transform pair, a trig identity, a simplified derivative |
| A quantity has a value | `evaluate` | a critical angle, an image distance, a settling time |
| An equation has these roots | `solve` | the mirror equation for `d_i`, poles of a transfer function |

Expressions are sympy syntax: `**` for powers, `1/(s**2 + 4)`, `exp(-3*t)`, `deg(asin(...))`,
`Heaviside(t)`. `equivalent` and `evaluate` accept an `lhs = rhs` equation and check the
difference. For transform work, the round-trip is usually the cleanest check — assert that
`laplace_transform(your_answer, t, s, noconds=True)` is `equivalent` to the `F(s)` you
started from, rather than trying to check an inverse directly.

## Reading the verdict

Three outcomes, and the third is the one that matters:

- **verified** — the CAS established it. Proceed.
- **WRONG** — fix it before the learner sees it. Do not teach the claim with a caveat, and
  do not argue with the checker; a numeric counterexample is a counterexample.
- **UNVERIFIED** — the checker could not decide (no interpreter, unparseable input, a
  simplification sympy could not close, a timeout). **This is not confirmation.** Either
  reformulate into a check that will land — a numeric `evaluate` at a specific point often
  succeeds where a symbolic `equivalent` stalls — or say plainly that the step is
  unverified. Never describe an UNVERIFIED result as checked.

If the checker is unavailable entirely, teach anyway. An unchecked lesson beats no lesson;
a silently unchecked lesson presented as checked does not.

## Teaching quantitative material

The `tutor` skill's lesson shape still applies — problem first, one worked example, name
the failure mode. Two additions for this subject family:

- **The failure mode is usually a sign, a direction or a unit.** Snell's law with the
  angles swapped, the mirror equation with the sign convention inverted, degrees where
  radians were meant, a region of convergence taken on the wrong side. Name the specific
  slip, not "be careful with signs".
- **Prefer a question with a computable answer.** "What is the critical angle for
  n = 1.5?" can be graded against a checked key. "Explain total internal reflection"
  cannot, and leaves you grading vibes. Ask both, but make at least one checkable.

## Grading

Unchanged, with one addition: when the question had a checked answer key and the learner's
answer disagrees with it, the key wins. Say what the right answer is and where their
reasoning diverged. When the learner's answer looks right but differs in *form* from the
key — `1/sqrt(2)` against `sqrt(2)/2` — run an `equivalent` check on the two before
marking it wrong. That specific mistake, marking a correct answer wrong because it was
written differently, is the fastest way to lose a learner's trust.

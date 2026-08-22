/**
 * Which prose is under the coverage guarantee, and which is not yet.
 *
 * The `excluded` and `DEFERRED` entries carry reasons because a coverage claim
 * whose exceptions cannot be enumerated is not a coverage claim. It is much easier
 * to leave a file off a list than to argue for leaving it off, and the difference
 * between those two is the whole value of the guarantee.
 */
import type { ProseSource } from "../prose.ts";

export const PROSE_SOURCES: readonly ProseSource[] = [
  {
    file: "skills/tutor/SKILL.md",
    prefix: "tutor",
    normativeHeadings: ["Assessing", "Building the roadmap", "Teaching", "Quizzing", "Tone"],
    excluded: [
      {
        heading: "The loop",
        why: "Procedural routing between tools — which aby_* call comes next given the state. It carries no claim about how people learn; the pedagogy it routes to is bound under the headings below.",
      },
    ],
  },
];

/**
 * Prose that will come under the guarantee later, with the reason it has not yet.
 *
 * Listed rather than omitted so the gap is a known size. Each of these contains
 * normative pedagogy that is currently unbound.
 */
export const DEFERRED_SOURCES: readonly { file: string; why: string }[] = [
  {
    file: "skills/math/SKILL.md",
    why: "Layers a verification discipline on top of the tutor skill. Its rules are about when to discharge a claim against a CAS rather than about how people learn, and several would need sources this corpus does not have yet (anchoring on one's own result, form-versus-value grading). Phase 2.",
  },
  {
    file: "prompts/harder.md",
    why: "A user-invoked difficulty escalation that bypasses nextAction entirely. Binding it properly means first deciding what target success rate aby is aiming at, which is an open question on the ratchet. Phase 2.",
  },
  {
    file: "prompts/recap.md",
    why: "Mostly presentation of state the learner already has. Reviewed and judged low-risk, not yet bound. Phase 2.",
  },
  {
    file: "extensions/aby.ts",
    why: "Tool descriptions and promptGuidelines carry a full grading rubric in string literals — 'Score is 0..1 ... Below 0.6 counts as a lapse' — which is pedagogy living where no scan over src/ finds it. It duplicates the SKILL.md rubric and must be bound to the same parameters so the two cannot drift apart. Phase 1, alongside the lapse-boundary fix.",
  },
];

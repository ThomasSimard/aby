import type { Paper } from "../types.ts";

/** What learners believe about their own learning, and why it is not evidence. */
export const METACOGNITION = {
  "bjork-2013-self-regulated-learning": {
    id: "bjork-2013-self-regulated-learning",
    authors: ["Bjork, R. A.", "Dunlosky, J.", "Kornell, N."],
    year: 2013,
    title: "Self-regulated learning: Beliefs, techniques, and illusions",
    venue: "Annual Review of Psychology, 64, 417-444",
    design: "review",
    findings: [],
    caveats: [
      "Concerns the LEARNER's judgements of their own learning. aby's `confidence` field is the MODEL's confidence in an assessment it just made, which is a different thing; citing this paper for that field would be a misattribution.",
      "Its live implication for aby is narrower and real: fluency during a lesson is a poor cue for retention, so assessment must rest on recorded performance rather than on how the session felt.",
    ],
    replication: "replicated",
  },
} as const satisfies Record<string, Paper>;

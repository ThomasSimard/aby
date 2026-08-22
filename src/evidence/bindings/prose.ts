import type { Binding } from "../types.ts";
import type { ProseParamId } from "../params.ts";

/**
 * Provenance for the tutor's prose.
 *
 * `skills/tutor/SKILL.md` is a prompt: every byte is model context on every
 * tutoring turn. So it stays clean — no citation markers, no footnotes, no HTML
 * comments — and everything that would have gone in it lives here instead, quoting
 * the file. The duplication is the mechanism: the copy is what notices when a rule
 * is reworded out from under the evidence that justified it.
 *
 * The `unsourced` entries are not an embarrassment to be minimised. Ten of the
 * tutor's twenty-eight normative rules have nothing behind them, and that is worth
 * knowing precisely, with the question that would settle each one written down.
 */
export const PROSE_BINDINGS = {
  "tutor/assessing/the-point-is-to-find-the": {
    param: "tutor/assessing/the-point-is-to-find-the",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/the-point-is-to-find-the", quote: "The point is to find the edge of what they know, not to test them exhaustively." },
    provenance: { kind: "unsourced", rationale: "Locating the boundary of competence is the stated goal of the interview. It is a reasonable goal and an unexamined one.", openQuestion: "Is finding the edge the right objective for a placement interview, against sampling breadth? Adaptive testing has a large literature (item response theory, computerised adaptive testing) and none of it is in this corpus yet." },
    claims: [],
  },
  "tutor/assessing/one-question-at-a-time-ask": {
    param: "tutor/assessing/one-question-at-a-time-ask",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/one-question-at-a-time-ask", quote: "One question at a time. Ask, stop, wait for the answer. Never send a numbered list of questions." },
    provenance: { kind: "unsourced", rationale: "A conversational-shape rule with a plausible measurement rationale: a batch of questions lets the learner read ahead and lets the model lecture.", openQuestion: "Does serial questioning actually produce a better placement than a batch, or is this only an interaction preference? Nothing here distinguishes the two." },
    claims: [],
  },
  "tutor/assessing/start-midrange-and-move-correct-and": {
    param: "tutor/assessing/start-midrange-and-move-correct-and",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/start-midrange-and-move-correct-and", quote: "Start mid-range and move. Correct and fluent → go harder. Wrong or hesitant → go easier. You are binary-searching for the boundary." },
    provenance: { kind: "unsourced", rationale: "This is binary search over difficulty, which is what computerised adaptive testing does — but aby does it with no item difficulty estimates and no stopping rule beyond the tutor's judgement.", openQuestion: "What does adaptive testing require to work: calibrated item difficulty, a measurement model, a defined stopping rule? aby has none of them and this rule borrows the shape without the machinery." },
    claims: [],
  },
  "tutor/assessing/ask-them-to-explain-or-predict": {
    param: "tutor/assessing/ask-them-to-explain-or-predict",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/ask-them-to-explain-or-predict", quote: "Ask them to explain or predict, not to recite. \"What happens if two threads both hold this?\" beats \"what does Arc stand for?\"." },
    provenance: { kind: "entailed", rationale: "Explanation and prediction are retrieval, and more effortful retrieval is where the testing effect is largest; reciting a definition is closer to recognition." },
    claims: ["retrieval/testing-beats-restudy", "metacognition/fluency-is-a-poor-cue-for-retention"],
  },
  "tutor/assessing/stop-when-placed-usually-36-questions": {
    param: "tutor/assessing/stop-when-placed-usually-36-questions",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/stop-when-placed-usually-36-questions", quote: "Stop when placed, usually 3–6 questions per topic. You are not marking an exam." },
    provenance: { kind: "unsourced", rationale: "Three to six is a plausible session length. It is not derived from anything about how reliable a judgement from that many items would be.", openQuestion: "How many items does it take before a level judgement is reliable enough to gate a roadmap? This is a measurement question with a standard answer shape (test reliability, Spearman-Brown) that has never been asked here." },
    claims: [],
    numbers: [{ n: 3, param: "assess/questions-per-topic-min" }, { n: 6, param: "assess/questions-per-topic-max" }],
  },
  "tutor/assessing/record-what-you-actually-saw-evidence": {
    param: "tutor/assessing/record-what-you-actually-saw-evidence",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/record-what-you-actually-saw-evidence", quote: "Record what you actually saw: evidence should quote or paraphrase their answer. Level 3 means \"can use it with docs open\", not \"seemed confident\"." },
    provenance: { kind: "entailed", rationale: "Recording the observed answer rather than the impression is the same discipline as grading against a key: how fluent someone sounded is a poor cue for what they retain." },
    claims: ["metacognition/fluency-is-a-poor-cue-for-retention"],
    numbers: [{ n: 3, notAParameter: "A point on the 0-5 assessment scale defined by aby_record_assessment, not a threshold of its own." }],
  },
  "tutor/assessing/never-call-abyrecordassessment-for-a-topic": {
    param: "tutor/assessing/never-call-abyrecordassessment-for-a-topic",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/never-call-abyrecordassessment-for-a-topic", quote: "Never call aby_record_assessment for a topic you did not probe." },
    provenance: { kind: "technical", forcedBy: "the store is the only memory across sessions; an assessment row with no probe behind it is fabricated data that every later decision reads as observed", rationale: "A data-integrity rule, not a claim about learning." },
    claims: [],
  },
  "tutor/assessing/say-what-you-concluded-and-let": {
    param: "tutor/assessing/say-what-you-concluded-and-let",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/assessing/say-what-you-concluded-and-let", quote: "Say what you concluded and let them correct you — self-report is evidence too." },
    provenance: { kind: "editorial", rationale: "An interaction choice about making the tutor's reasoning contestable. The trailing clause that self-report is evidence is in tension with metacognition/fluency-is-a-poor-cue-for-retention and is left standing deliberately: it is evidence, just weak evidence." },
    claims: [],
  },
  "tutor/building-the-roadmap/nodes-are-things-you-can-teach": {
    param: "tutor/building-the-roadmap/nodes-are-things-you-can-teach",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/building-the-roadmap/nodes-are-things-you-can-teach", quote: "Nodes are things you can teach in one sitting. Edges are hard prerequisites: \"you cannot understand B until you can do A\". If B is merely easier after A, do not add the edge — spurious prerequisites lock the graph up and make the plan feel longer than it is." },
    provenance: { kind: "entailed", rationale: "Hard prerequisites and nothing else is what makes the roadmap a prerequisite-closed structure with a meaningful fringe; adding merely-helpful edges destroys the property the available/locked distinction depends on." },
    claims: ["sequencing/competence-is-a-prerequisite-closed-state-with-a-fringe"],
  },
  "tutor/building-the-roadmap/start-from-what-they-already-know": {
    param: "tutor/building-the-roadmap/start-from-what-they-already-know",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/building-the-roadmap/start-from-what-they-already-know", quote: "Start from what they already know. Do not add nodes for skills already assessed at level 4–5; the roadmap is what's missing, not a syllabus of the whole field." },
    provenance: { kind: "entailed", rationale: "Teaching an item already in the learner's knowledge state is work with nothing behind it; the roadmap is the gap, not the field." },
    claims: ["sequencing/competence-is-a-prerequisite-closed-state-with-a-fringe"],
    numbers: [{ n: 4, param: "roadmap/skip-at-or-above-level" }, { n: 5, notAParameter: "The top of the 0-5 assessment scale, fixed by the tool schema." }],
  },
  "tutor/building-the-roadmap/820-nodes-is-usually-right-if": {
    param: "tutor/building-the-roadmap/820-nodes-is-usually-right-if",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/building-the-roadmap/820-nodes-is-usually-right-if", quote: "8–20 nodes is usually right. If it is much bigger, the goal needs narrowing." },
    provenance: { kind: "unsourced", rationale: "A judgement about how large a plan can be before it stops feeling finishable. There is no evidence behind either endpoint.", openQuestion: "Is there a curriculum size beyond which learners disengage, and does it depend on node granularity rather than count? Motivation and goal-setting literature would be the place to look; none of it is in this corpus." },
    claims: [],
    numbers: [{ n: 8, param: "roadmap/node-count-min" }, { n: 20, param: "roadmap/node-count-max" }],
  },
  "tutor/building-the-roadmap/ids-are-stable-slugs-btreesplits-reuse": {
    param: "tutor/building-the-roadmap/ids-are-stable-slugs-btreesplits-reuse",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/building-the-roadmap/ids-are-stable-slugs-btreesplits-reuse", quote: "Ids are stable slugs (btree-splits). Reuse existing ids when revising, or the learner's mastery on those nodes is lost." },
    provenance: { kind: "technical", forcedBy: "upsertNodes preserves mastery and review state by node id — a renamed id silently resets a learner's progress on that node to zero", rationale: "A data-integrity rule enforced by the store's merge key, not a claim about learning." },
    claims: [],
  },
  "tutor/building-the-roadmap/send-the-whole-roadmap-on-every": {
    param: "tutor/building-the-roadmap/send-the-whole-roadmap-on-every",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/building-the-roadmap/send-the-whole-roadmap-on-every", quote: "Send the whole roadmap on every aby_upsert_roadmap call." },
    provenance: { kind: "technical", forcedBy: "aby_upsert_roadmap validates the merged graph before writing, so a partial roadmap cannot be checked for cycles or dangling prerequisites", rationale: "A tool-contract rule." },
    claims: [],
  },
  "tutor/building-the-roadmap/if-the-tool-rejects-a-cycle": {
    param: "tutor/building-the-roadmap/if-the-tool-rejects-a-cycle",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/building-the-roadmap/if-the-tool-rejects-a-cycle", quote: "If the tool rejects a cycle, fix the edges and call it again — do not work around it." },
    provenance: { kind: "technical", forcedBy: "assertValidDag rejects cycles because topological order — and therefore any notion of what is available next — is undefined without one", rationale: "A tool-contract rule; the error message is the recovery instruction." },
    claims: [],
  },
  "tutor/teaching/before-writing-call-abyfindsimilar-for-the": {
    param: "tutor/teaching/before-writing-call-abyfindsimilar-for-the",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/teaching/before-writing-call-abyfindsimilar-for-the", quote: "Before writing, call aby_find_similar for the node's topic. If you have taught it before, build on that lesson rather than repeating it — reference what they already saw and go a level deeper." },
    provenance: { kind: "unsourced", rationale: "Two rules in one sentence: check the store before writing (mechanical), and build on a prior lesson rather than repeating it (pedagogy). Only the first is grounded.", openQuestion: "Does elaborative re-teaching beat repetition for a topic already covered, and by how much? Plausible from the spacing and elaboration literature, but nothing in this corpus tests it." },
    claims: [],
  },
  "tutor/teaching/a-lesson-should": {
    param: "tutor/teaching/a-lesson-should",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/teaching/a-lesson-should", quote: "A lesson should:" },
    provenance: { kind: "editorial", rationale: "A sentence fragment introducing the list that follows. It carries no rule of its own; the rules are the four bullets under it." },
    claims: [],
  },
  "tutor/teaching/lead-with-the-problem-the-concept": {
    param: "tutor/teaching/lead-with-the-problem-the-concept",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/teaching/lead-with-the-problem-the-concept", quote: "lead with the problem the concept solves, before the mechanics;" },
    provenance: { kind: "unsourced", rationale: "Problem-before-mechanism is a widely held teaching preference and is not supported by anything in this corpus.", openQuestion: "Does motivating a concept with the problem it solves improve retention or transfer, against presenting the mechanism first? Productive failure and problem-based learning are the relevant literatures and neither is represented here." },
    claims: [],
  },
  "tutor/teaching/use-one-worked-example-the-learner": {
    param: "tutor/teaching/use-one-worked-example-the-learner",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/teaching/use-one-worked-example-the-learner", quote: "use one worked example the learner can run or trace by hand;" },
    provenance: { kind: "entailed", rationale: "The worked example effect is real for learners new to the material. Note what this rule gets WRONG: it is unconditional, and the evidence says the benefit shrinks and then reverses as prior knowledge grows. aby stores an assessed level per topic and ignores it here." },
    claims: ["instruction/worked-examples-help-novices-and-hinder-experts"],
  },
  "tutor/teaching/name-the-failure-mode-the": {
    param: "tutor/teaching/name-the-failure-mode-the",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/teaching/name-the-failure-mode-the", quote: "name the failure mode — the mistake people actually make here;" },
    provenance: { kind: "unsourced", rationale: "Pre-empting the common error is a strong teaching instinct with no support recorded here.", openQuestion: "Does naming a likely misconception before it occurs reduce it, or does it introduce it? The misconception and refutation-text literature has answers and is not in this corpus." },
    claims: [],
  },
  "tutor/teaching/stay-in-one-sittings-worth-of": {
    param: "tutor/teaching/stay-in-one-sittings-worth-of",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/teaching/stay-in-one-sittings-worth-of", quote: "stay in one sitting's worth of material. Depth over coverage." },
    provenance: { kind: "unsourced", rationale: "A limit on how much is presented at once, justified by nothing more than the observation that too much at once does not stick.", openQuestion: "What actually bounds how much a learner can absorb in one lesson, and is it quantity, element interactivity, or session time? Cognitive load theory is the obvious source and is absent from this corpus." },
    claims: [],
  },
  "tutor/teaching/then-call-abysavelesson-with-the-full": {
    param: "tutor/teaching/then-call-abysavelesson-with-the-full",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/teaching/then-call-abysavelesson-with-the-full", quote: "Then call aby_save_lesson with the full text you showed them." },
    provenance: { kind: "technical", forcedBy: "the lesson store is what aby_find_similar searches; an unsaved lesson is invisible to every later turn", rationale: "A tool-contract rule." },
    claims: [],
  },
  "tutor/quizzing/call-abyfindsimilar-first-and-avoid-reasking": {
    param: "tutor/quizzing/call-abyfindsimilar-first-and-avoid-reasking",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/quizzing/call-abyfindsimilar-first-and-avoid-reasking", quote: "Call aby_find_similar first and avoid re-asking a question they have already seen." },
    provenance: { kind: "unsourced", rationale: "Avoiding a repeat question is sound — a second encounter with the same item tests recognition of the item rather than the knowledge — but nothing here establishes it.", openQuestion: "How much does repeating an identical question inflate a score relative to a fresh question on the same material? This matters directly, because an inflated score multiplies the review interval." },
    claims: [],
  },
  "tutor/quizzing/ask-for-application-or-prediction-not": {
    param: "tutor/quizzing/ask-for-application-or-prediction-not",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/quizzing/ask-for-application-or-prediction-not", quote: "Ask for application or prediction, not recall of your own phrasing. Good: give a snippet and ask what it prints and why. Weak: \"what are the three rules of X?\"." },
    provenance: { kind: "entailed", rationale: "Application and prediction are effortful retrieval; reciting the tutor's own phrasing is closer to recognition, where the testing effect is weakest." },
    claims: ["retrieval/testing-beats-restudy"],
  },
  "tutor/quizzing/one-question-at-a-time-wait": {
    param: "tutor/quizzing/one-question-at-a-time-wait",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/quizzing/one-question-at-a-time-wait", quote: "One question at a time. Wait." },
    provenance: { kind: "editorial", rationale: "An interaction-shape rule, the same choice as in the assessment section." },
    claims: [],
  },
  "tutor/quizzing/grade-honestly-against-the-answer-key": {
    param: "tutor/quizzing/grade-honestly-against-the-answer-key",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/quizzing/grade-honestly-against-the-answer-key", quote: "Grade honestly against the answer key and call aby_record_quiz every time, including for correct answers — the review schedule only advances on recorded successes, and inflated scores push the next review out too far. Scores: 1.0 correct with the right reasoning, ~0.5 right answer with shaky or missing reasoning, 0 wrong. Below 0.6 is a lapse and the node returns tomorrow." },
    provenance: { kind: "entailed", rationale: "Two grounded things: the schedule only advances on recorded outcomes, and an inflated score pushes the next review further out — so grading generously trades a moment of comfort for retention. The rubric's own numbers are a separate matter and are bound individually." },
    claims: ["retrieval/testing-beats-restudy", "metacognition/fluency-is-a-poor-cue-for-retention"],
    numbers: [{ n: 1.0, notAParameter: "The top of the 0..1 score range accepted by aby_record_quiz." }, { n: 0.5, param: "grade/score-partial-credit" }, { n: 0, notAParameter: "The bottom of the 0..1 score range accepted by aby_record_quiz." }, { n: 0.6, param: "grade/lapse-threshold" }],
  },
  "tutor/quizzing/tell-them-what-was-wrong-and": {
    param: "tutor/quizzing/tell-them-what-was-wrong-and",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/quizzing/tell-them-what-was-wrong-and", quote: "Tell them what was wrong and why before moving on. A graded answer with no explanation teaches nothing." },
    provenance: { kind: "entailed", rationale: "Feedback is part of the retrieval-practice mechanism rather than a courtesy, and the wording — what was wrong and why, about the answer — is the form the evidence favours." },
    claims: ["retrieval/feedback-strengthens-the-testing-effect", "feedback/task-focused-feedback-helps-self-focused-feedback-harms"],
  },
  "tutor/quizzing/when-abyrecordquiz-reports-lapsed-true-dont": {
    param: "tutor/quizzing/when-abyrecordquiz-reports-lapsed-true-dont",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/quizzing/when-abyrecordquiz-reports-lapsed-true-dont", quote: "When aby_record_quiz reports lapsed: true, don't just move on — that node was supposed to be known. Re-explain the specific thing they missed." },
    provenance: { kind: "entailed", rationale: "Targeted re-explanation of the specific error is feedback, which is supported. There is a tension worth watching: the evidence favours retrieving a forgotten item again over re-presenting it, so this rule is right only so long as re-explaining stays narrow and is followed by another attempt." },
    claims: ["retrieval/feedback-strengthens-the-testing-effect", "retrieval/testing-beats-restudy"],
  },
  "tutor/tone/direct-and-warm-do-not-congratulate": {
    param: "tutor/tone/direct-and-warm-do-not-congratulate",
    target: { kind: "prose", file: "skills/tutor/SKILL.md", unit: "tutor/tone/direct-and-warm-do-not-congratulate", quote: "Direct and warm. Do not congratulate correct answers at length, and do not soften wrong ones into sounding right — being told plainly that you are wrong, and why, is the fastest way to learn. Assume intelligence, don't assume knowledge." },
    provenance: { kind: "entailed", rationale: "The strongest empirical assertion in SKILL.md. The evidence supports the shape of it — feedback about the task helps, and softening a wrong answer removes the task information — but not the superlative: a third of feedback interventions make performance worse, and being told plainly is not automatically the fastest way to learn. Kept because the operational rule it produces is the right one." },
    claims: ["feedback/task-focused-feedback-helps-self-focused-feedback-harms"],
  },
} as const satisfies Partial<Record<ProseParamId, Binding>>;

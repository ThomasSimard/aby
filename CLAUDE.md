# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

aby is a **pi extension package**, not a standalone program. There is no build step and no
entry point you run directly — the [pi](https://pi.dev) agent harness loads `extensions/aby.ts`
(and `skills/`, `prompts/`) as declared in `package.json`'s `pi` field and mirrored in
`.pi/settings.json`. To exercise the real thing you run `pi` from the repo root.

## Commands

```sh
nix develop                      # pi, node 24, pnpm, graphviz, python+sympy, claude-code
pnpm install
pnpm check                       # tsc --noEmit
pnpm test                        # node --test test/*.test.ts
node --test test/plan.test.ts    # one file
pi                               # run the tutor; /assess /roadmap /learn /quiz /progress
```

`nix develop` matters for more than convenience: `@lancedb/lancedb` and `onnxruntime-node` ship
prebuilt `.node` addons that dlopen libstdc++/libz/libssl, and the shell's `LD_LIBRARY_PATH`
export is what makes them loadable. `pnpm-workspace.yaml` keeps all lifecycle scripts off
(`allowBuilds: false`) because the prebuilt binaries work as shipped.

`graphviz`'s `dot` must be on PATH — `aby_render_roadmap` and `flow.test.ts` shell out to it.
Same for `python3` with `sympy` — `aby_check` and `verify.test.ts` shell out to that. Both are
in the dev shell; `verify.test.ts` honours `ABY_PYTHON` if you need a different interpreter.

## TypeScript constraints (not negotiable)

pi executes `.ts` files through Node's native type stripping, so `tsconfig.json` sets
`allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noEmit`:

- **Relative imports must carry the `.ts` extension** (`from "./graph.ts"`).
- No enums, namespaces, or parameter properties — nothing that needs emit.
- Type-only imports must use `import type`.
- `noUncheckedIndexedAccess` is on, so array/map indexing yields `T | undefined`; the codebase
  handles this with `?? fallback` rather than non-null assertions.

## Architecture

The organising principle: **the model decides *how* to teach; `src/` decides *what's next*.**
Anything that is arithmetic over dates and counters is a pure function, because that is exactly
what an LLM drifts on across a long session.

```
skills/tutor/SKILL.md   pedagogy — how to interview, scope nodes, teach, grade (model-facing prose)
skills/math/SKILL.md    layers onto tutor: check every result with aby_check before teaching it
extensions/aby.ts       the tutor's pi-facing layer: 9 aby_* tools + 5 slash commands + the chrome
  src/plan.ts           nextAction(): pure state → one of set_goal|assess|build_roadmap|review|learn|done
  src/graph.ts          roadmap DAG: cycle detection, topo order, status, DOT/Mermaid, `dot` shell-out
  src/schedule.ts       SM-2 review scheduling + mastery EMA (pure, `now` always injected)
  src/grade.ts          the quiz core loop (record → mastery → reschedule), extracted so it's testable
  src/view.ts           layout: mastery bars, the progress card, the widget (pure, width in → Block out)
  src/store.ts          LanceDB persistence, the only I/O module
  src/embed.ts          local ONNX embeddings (Anthropic has no embeddings endpoint)
extensions/verify.ts    aby_check: discharge a claim against a CAS before the learner sees it
  src/verify.ts         check validation, three-way verdicts, the python spawn (timeout + signal)
  src/checkers/cas.py   the sympy driver — JSON on stdin, one JSON verdict on stdout
extensions/mermaid.ts   /mermaid <file>: a viewer, unrelated to the tutor loop
  src/mermaid.ts        fence extraction + the fit-to-width decision (pure)
extensions/ui/          shared UI — a subdirectory so pi does not load it as an extension
  paint.ts              Block → themed terminal lines, plus the BlockView component
  diagram.ts            Mermaid drawing shared by the roadmap entry and /mermaid
src/evidence/           the provenance registry — TEST-TIME ONLY, never imported at runtime
  papers/               the corpus: what each study did, what it found, what is wrong with it
  claims/               testable propositions, each supported by paper findings
  bindings/             parameter → claims + provenance kind; prose/ quotes SKILL.md verbatim
  params.ts             the hand-written union of every parameter that influences learning
  scan.ts prose.ts      AST and markdown scanning (pure), derive.ts the computable derivations
  ratchet.ts            the closed set of admitted unknowns; it can only shrink
scripts/evidence.ts     coverage report + the open-question backlog (maintainer-facing)
```

Shared UI code lives one level down, in `extensions/ui/`: pi loads **every** `.ts` file directly
inside an extensions directory as an extension and rejects any that does not default-export a
factory, while a subdirectory without an `index.ts` is skipped entirely. A helper module beside
`aby.ts` is a startup error, not a helper.

`extensions/aby.ts` is deliberately thin: parameter schemas (typebox), validation, and
delegation. New logic belongs in `src/` where a test can reach it without a model in the loop.
That applies to *layout* too — `src/view.ts` decides what goes where at a given width and what
each run means; `extensions/ui/paint.ts` only applies the theme. It is why `test/view.test.ts` can
assert that no line overflows its viewport without a terminal.

### Tool contract

Tools **throw on invalid input** rather than absorbing it — pi surfaces the error text to the
model, which corrects itself. `aby_upsert_roadmap` rejects cycles, self-references, duplicate ids
and prereqs naming unknown nodes; unknown-node errors list the known ids so the model can
recover. Keep this style: an error message is a prompt.

Roadmap upserts validate against the **merged** graph (existing + incoming) before writing, and
preserve `mastery`/`review` for any reused node id — re-proposing a roadmap must never wipe out
earned progress.

### State machine

`statusOf()` (`src/graph.ts`) derives one of `mastered | due | available | locked` from mastery
plus prereq mastery plus the due date. `nextAction()` (`src/plan.ts`) walks topo order and
prioritises **due reviews over new material** — a lapsed prerequisite makes everything downstream
shakier. A node whose mastery falls back below the threshold becomes `available` again, so it is
re-*taught*, not lightly reviewed.

Numbers that tests depend on: `MASTERY_THRESHOLD = 0.8`, `MASTERY_ALPHA = 0.4` (so four correct
answers are needed to cross the threshold from zero), and a lapse boundary that is currently **two
different numbers** — `LAPSE_THRESHOLD = 0.6` in `grade.ts` decides the `lapsed` flag the learner
and the model see, while `scheduleNext` lapses on `scoreToQuality(score) < 3`, which is score
`< 0.5` because `Math.round(2.5) === 3` in JS. A score of exactly `0.5` is therefore reported as a
lapse and scheduled as a success. That defect is recorded in the registry
(`grade/lapse-threshold`) rather than quietly fixed, because deciding what the boundary *should*
be is a separate question from making the two agree.

Every one of those numbers is now bound in `src/evidence/` — see below for what that buys.

### Verification

`aby_check` (`extensions/verify.ts`) is the only ground-truth channel in the codebase.
Everything else the tutor asserts is graded by the model against an `answerKey` the same
model wrote in the same turn — and because SM-2 multiplies the interval on every success,
one inflated score keeps pushing a topic further away. The checker exists to break that
circle for anything a CAS can settle.

Two invariants:

- **Three-way verdicts.** `ok: false, inconclusive: true` means *not checked*, which is a
  different claim from *checked and wrong*. `src/checkers/cas.py` never reports an
  equivalence it could not prove: a failed `simplify` falls through to a numeric probe at
  fixed (not random — verdicts must reproduce) sample points, and only a disagreeing probe
  downgrades to WRONG. Collapsing the two states would launder an unproven claim into a
  verified one, which is worse than not checking at all.
- **Advisory, never blocking.** A missing interpreter, an unparseable expression or a
  timeout resolves to `inconclusive`; the tutor teaches anyway and says the step is
  unchecked. Same posture as `graphicsAvailable()` and the try/catch around `renderDot` —
  a hard gate turns every checker hiccup into a stalled session.

`runCheck` follows `renderDot`'s shell-out shape (argv array so there is no shell, payload
on stdin rather than a temp file, stderr surfaced) and adds the two things `dot` never
needed: a timeout and the turn's `AbortSignal`, because a CAS call is seconds not
milliseconds. Note the tool keeps the `aby_` name prefix deliberately — `aby.ts`'s
`tool_execution_end` hook filters on it — and sets no widget, because `ctx.ui.setWidget`
is keyed and the tutor's chrome owns the key `"aby"`.

### Evidence

Every number and every normative rule that influences learning is bound to a source in
`src/evidence/`, and `test/evidence.test.ts` fails when one is not. The point is not the
bibliography. It is that **an arbitrary number must not be able to look evidenced** — a registry
where any constant can be given a plausible DOI is worse than none, because it launders a guess
into a finding. That is the same failure `aby_check` exists to prevent on the mathematical side.

**The dependency rule.** `test/` → `src/evidence/` → nothing. No module under `src/` or
`extensions/` may import the corpus, and a test enforces it by scanning every `.ts` pi can load.
One import would put twenty papers of prose into every session's context. Bindings therefore name
parameters by string, and the test imports both the live module and the registry to check they
still agree. This is also why there is no `evidenced(id, 1.3)` call-site marker: it would invert
the dependency, pull the corpus into runtime, and *still* need the registry check to catch
disagreement.

**Provenance kinds earn themselves.** The guards are structural, not conventional:

- `reported` requires a finding id, and the test compares the two numbers. You cannot write a
  number beside a citation — you must point at a numeric field of a paper record.
- `derived` requires a derivation from `derive.ts`, which the test runs.
- `bounded` endpoints have **no free-literal case in the type**: an endpoint is a finding, another
  parameter, a logical bound, or a derivation over those. The literature owns the interval; the
  maintainer owns only the point inside it.
- `conventional` may cite only `sort: "practice"` claims, so an inherited constant can never wear
  a real result's authority, and must declare `switchWhen` — what evidence would retire it.
- `technical`, `editorial` and `unsourced` carry **no** claims. They are not escape hatches, they
  are the point: the honest reading of "no unsourced pedagogy" is "no *silently* unsourced
  pedagogy". Nineteen of aby's forty-two parameters are unsourced, each with the question that
  would settle it. `node scripts/evidence.ts` prints them as a backlog.

**`pnpm check` is a real gate here, not hygiene.** `params.ts` hand-declares the parameter ids and
`bindings/index.ts` is checked against `{ [K in ParamId]: Binding<K> }`, so a declared parameter
with no binding, a key disagreeing with its own `param`, a dangling claim or paper id, or a
citation to a finding that does not exist on the paper it names are all **compile** errors. The
union is hand-written because deriving it (`keyof typeof BINDINGS`) is circular and TypeScript
rejects it — which turns out to be the stronger design, since it catches missing bindings too.

**Pedagogy in prose is pedagogy.** `skills/tutor/SKILL.md` is a prompt, so it stays clean — no
citation markers, no footnotes, no HTML comments, nothing costing model context. Provenance lives
in `bindings/prose.ts`, which quotes the file, and the duplication *is* the tripwire. Quotes are
matched after normalising whitespace and markdown emphasis, so rewrapping the file is free and
rewording a rule is not. Unit ids are the heading plus the first six words, generated rather than
chosen, so reordering bullets is free too. Three things are checked: every quote still appears,
every normative unit is bound (this is what catches pedagogy being *added* — a citation comment
in the file never could), and **every number inside a quoted rule resolves to a parameter**. That
last one is why "3–6 questions per topic" and "8–20 nodes" are now registry entries: numbers in a
prompt are decisions that no scan over `src/` would ever find.

**The ratchet is a set, not a count** (`ratchet.ts`). Set equality with the bindings means adding
an unsourced parameter fails until you edit the file — debt always arrives as a visible diff — and
*sourcing* one also fails, telling you to remove it and lower `MAX_UNSOURCED`. A count alone would
let you swap one unknown for another and stay green.

**Verifying the gate still works.** Four experiments, each proving a different mechanism, all
revertible — worth running if you ever doubt the check is live (note `src/evidence/` is untracked
until committed, so `git checkout` will not undo #4):

1. Change `MIN_EASE` to `1.35` → *"schedule/min-ease: registry says 1.3, src/schedule.ts exports
   1.35"*.
2. Add `export const FUDGE = 0.7;` to `src/schedule.ts` → a paste-ready binding stub.
3. Change "usually 3–6 questions per topic" to "3–8" in SKILL.md → **two** failures: the quote no
   longer appears, and the reworded rule's id changed so it is now unbound.
4. Delete the `math-g` finding from `brunmair2019` → `pnpm check` fails, not the test.

**What is not covered yet**, declared rather than omitted: `LITERAL_SCAN` is empty, so only
*exported* numbers are checked — turning a module on requires naming its numbers first.
`skills/math/SKILL.md`, `prompts/`, and the grading rubric embedded in `extensions/aby.ts`'s tool
descriptions are listed in `DEFERRED_SOURCES` with reasons. `src/checkers/cas.py` is Python and
invisible to a TypeScript AST walk.

### What the learner sees

Three surfaces, all of them driven from `src/view.ts`:

- **`/progress`** appends a custom *entry* (`aby-progress`) with a registered `EntryRenderer`.
  Entries are durable across a reload but never enter the model's context, which is what makes
  the command genuinely free — it was previously a `sendMessage`, so the "no model call" claim
  was only half true. The model has `aby_get_profile` when it actually needs the state.
- **`aby_render_roadmap`** still writes `.aby/roadmap.{svg,dot}` and returns the same JSON, but
  also appends an `aby-roadmap` entry. In a terminal with a graphics protocol that entry is the
  real PNG; everywhere else it is Unicode art, tried left-to-right first and then top-down,
  because the same chain is ~90 columns wide one way and ~25 the other. The base64 lives in a
  module-level cache keyed by path, never in the entry: a session file is JSONL, and after a
  reload the art — which is also what works over SSH — is the durable representation.
- **The widget above the editor** (`ctx.ui.setWidget`) is rebuilt by `refreshChrome()` on
  `session_start` and after any `aby_*` tool call. It reads the store rather than tracking
  changes incrementally, because re-reading is cheaper than being wrong.

Status marks are single-width on purpose (`STATUS_MARK` in `src/graph.ts`, beside the graphviz
palette): the old 🔒 is double-width, which knocks the mastery column out of alignment and
inflates the width grok-mermaid computes for a node label.

### The mermaid viewer

`/mermaid <file>` exists because pi's built-in mermaid rendering (`markdown.mermaid`) only sees
chat *messages*; a diagram in a file arrives as a tool result and misses the transformer. It
reuses pi's own renderer, `grok-mermaid`, so a file diagram and a chat diagram look identical.

Two constraints worth keeping:

- The rendering is a **custom entry** (`pi.appendEntry` + `registerEntryRenderer`), not a message.
  Same reasoning as the roadmap and progress entries above; `DiagramView` is shared with them.
  Entries are durable but stay out of the model's context — box-drawing art tells the model
  nothing the source doesn't.
- Only the mermaid **source** is stored; `DiagramView.render(width)` redraws each time, so a
  resize re-lays-out and a theme change re-colours. Art laid out for yesterday's width would wrap
  into noise. Anything wider than the viewport falls back to the framed source with the reason.

### Storage

One embedded LanceDB database at `~/.local/share/aby` (override with `ABY_DATA_DIR`); vector
search and scalar filtering live in the same tables, so there is no second store.

- Tables are created from **explicit Arrow schemas** (`SCHEMAS` in `src/store.ts`), never
  inferred from the first row — an empty database must have the same shape as a populated one.
  Adding a field means editing the schema *and* `rowToNode`/`nodeToRow`.
- Encoding conventions: `prereqs` is a JSON-encoded string (avoids Arrow list handling for a
  field only ever read/written whole); `dueAt` uses `""` for "never scheduled" to keep the column
  simple to filter; the profile is a single row keyed `id = 'singleton'`.
- All writes go through `mergeInsert` upserts on a key column.
- Every row carries a 384-dim vector from `src/embed.ts` (`Xenova/all-MiniLM-L6-v2`, ~90MB
  downloaded to `~/.cache/aby/models` on first use, offline thereafter).

### Testing

Tests are plain `node:test`, no framework, and none need an API key. The two integration tests
(`store.test.ts`, `flow.test.ts`) hit real LanceDB and real embeddings against a temp dir — they
are the only proof the Arrow schemas round-trip. `verify.test.ts` shells out to a real sympy the
way `graph.test.ts` shells out to a real `dot`; its pure half (validation, verdict parsing) runs
without one, and its degradation cases deliberately point at an interpreter that does not exist.

The setup order in those files is load-bearing: set `process.env.ABY_DATA_DIR`, then
**dynamically** `await import("../src/store.ts")`, then call `store.resetConnection()`. A
top-level static import would bind the connection to the default data directory first.

`flow.test.ts` is the end-to-end state machine (goal → assess → roadmap → teach → quiz → lapse →
review) with the model's judgement calls stubbed as fixed inputs; it is the right place to prove
a behaviour change in the loop.

`evidence.test.ts` is the odd one out in the other direction: it is pure plus `readFileSync` — no
key, no network, no LanceDB, no `dot`, no python — and runs in about half a second. That is a
requirement rather than a nicety, because it is the gate that must never be worth skipping. It
parses with `ts.createSourceFile` only (no `createProgram`, no type checker), which is why it is
fast; `typescript` is already a devDependency, so this costs no new package.

## Conventions

- Comments explain *why*, not what — particularly the non-obvious constraints (why the profile is
  a singleton row, why `cap`-style clamps exist, why validation happens pre-merge). Preserve that
  reasoning when editing near it.
- Pure modules (`schedule.ts`, `plan.ts`, most of `graph.ts`) do no I/O and never read the clock;
  `now: Date` is always a parameter. Keep it that way — it's what makes the tests deterministic.
- Changing pedagogy means editing `skills/tutor/SKILL.md`, not the tool descriptions. Changing
  what the tutor is *allowed* to do means editing the tools.

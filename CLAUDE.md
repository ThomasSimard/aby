# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

aby is a **pi extension package**, not a standalone program. There is no build step and no
entry point you run directly — the [pi](https://pi.dev) agent harness loads `extensions/aby.ts`
(and `skills/`, `prompts/`) as declared in `package.json`'s `pi` field and mirrored in
`.pi/settings.json`. To exercise the real thing you run `pi` from the repo root.

## Commands

```sh
nix develop                      # pi, node 24, pnpm, graphviz, claude-code
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
extensions/aby.ts       the only pi-facing layer: 9 aby_* tools + 5 slash commands
  src/plan.ts           nextAction(): pure state → one of set_goal|assess|build_roadmap|review|learn|done
  src/graph.ts          roadmap DAG: cycle detection, topo order, status, DOT/Mermaid, `dot` shell-out
  src/schedule.ts       SM-2 review scheduling + mastery EMA (pure, `now` always injected)
  src/grade.ts          the quiz core loop (record → mastery → reschedule), extracted so it's testable
  src/store.ts          LanceDB persistence, the only I/O module
  src/embed.ts          local ONNX embeddings (Anthropic has no embeddings endpoint)
extensions/mermaid.ts   /mermaid <file>: a viewer, unrelated to the tutor loop
  src/mermaid.ts        fence extraction + the fit-to-width decision (pure)
```

`extensions/aby.ts` is deliberately thin: parameter schemas (typebox), validation, and
delegation. New logic belongs in `src/` where a test can reach it without a model in the loop.

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
answers are needed to cross the threshold from zero), lapse below score `0.6` (SM-2 quality < 3).

### The mermaid viewer

`/mermaid <file>` exists because pi's built-in mermaid rendering (`markdown.mermaid`) only sees
chat *messages*; a diagram in a file arrives as a tool result and misses the transformer. It
reuses pi's own renderer, `grok-mermaid`, so a file diagram and a chat diagram look identical.

Two constraints worth keeping:

- The rendering is a **custom entry** (`pi.appendEntry` + `registerEntryRenderer`), not a message.
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
are the only proof the Arrow schemas round-trip.

The setup order in those files is load-bearing: set `process.env.ABY_DATA_DIR`, then
**dynamically** `await import("../src/store.ts")`, then call `store.resetConnection()`. A
top-level static import would bind the connection to the default data directory first.

`flow.test.ts` is the end-to-end state machine (goal → assess → roadmap → teach → quiz → lapse →
review) with the model's judgement calls stubbed as fixed inputs; it is the right place to prove
a behaviour change in the loop.

## Conventions

- Comments explain *why*, not what — particularly the non-obvious constraints (why the profile is
  a singleton row, why `cap`-style clamps exist, why validation happens pre-merge). Preserve that
  reasoning when editing near it.
- Pure modules (`schedule.ts`, `plan.ts`, most of `graph.ts`) do no I/O and never read the clock;
  `now: Date` is always a parameter. Keep it that way — it's what makes the tests deterministic.
- Changing pedagogy means editing `skills/tutor/SKILL.md`, not the tool descriptions. Changing
  what the tutor is *allowed* to do means editing the tools.

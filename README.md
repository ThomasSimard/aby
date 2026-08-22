# aby

A learning tutor that runs inside [pi](https://pi.dev), Mario Zechner's minimal
agent harness. It finds your current level by interviewing you, builds a
prerequisite graph from there to where you want to get, writes lessons, and quizzes
you with spaced repetition.

pi and the model own the conversation. aby's tools own the state a language model is
bad at holding across sessions: mastery scores, the roadmap DAG, review due dates,
and what has already been taught.

## Quick start

```sh
nix develop            # pi, node, pnpm, graphviz, python+sympy
pnpm install
pi                     # loads aby via .pi/settings.json
```

Then, in pi:

```
/assess rust           # interview to find your level
/roadmap               # build and render the graph
/learn                 # teach the next node
/quiz                  # test what should have stuck
/progress              # status report (no model call, never enters context)
```

Prompt templates: `/recap` for where you're at, `/harder` for a tougher variant of
the last question.

`/mermaid <path>` draws the Mermaid diagrams in a `.md` (or `.mmd`) file as Unicode
art in the transcript. pi renders mermaid fences that appear in *messages* already;
this covers the case it cannot see, a diagram sitting in a file — `read` output is a
tool result, which never passes through pi's markdown transformer. The drawing is a
custom entry: durable across reloads, never sent to the model.

**Authentication:** pi is bring-your-own-key. Run `/login` inside pi, or set
`ANTHROPIC_API_KEY`. The provider defaults to `anthropic` in `.pi/settings.json`;
switch models with `/model` or `Ctrl+L`.

**First run** downloads a ~90MB embedding model (`Xenova/all-MiniLM-L6-v2`) into
`~/.cache/aby/models`. After that, embeddings run offline.

## Where the numbers come from

Every constant and every tutoring rule that affects what you learn is tied to a source in
`src/evidence/`, and the test suite fails if one is not. Nineteen of aby's forty-two learning
parameters currently have **nothing** behind them — SM-2's ease factors are inherited convention,
the 0.8 mastery cut was picked because it reads as "mostly right" — and each of those carries the
question that would settle it. `node scripts/evidence.ts` prints the coverage and the backlog.

The corpus is maintainer-facing: it never enters the model's context or the tutor's output, and a
test enforces that nothing aby loads at runtime can import it.

## How it works

| Piece | Role |
|---|---|
| `extensions/aby.ts` | Registers the nine `aby_*` tools, the five slash commands and the UI |
| `extensions/verify.ts` | `aby_check` — verifies a claim with a CAS before it is taught |
| `src/verify.ts` | Check validation, three-way verdicts, the sympy shell-out |
| `extensions/mermaid.ts` | `/mermaid` — draws a file's Mermaid diagrams in the transcript |
| `extensions/ui/diagram.ts` | Mermaid drawing, shared by the roadmap and `/mermaid` |
| `extensions/ui/paint.ts` | Applies the active theme to a laid-out block |
| `skills/tutor/SKILL.md` | The pedagogy: how to interview, scope nodes, teach and grade |
| `skills/math/SKILL.md` | Adds to it for quantitative subjects: check results before teaching them |
| `src/plan.ts` | Decides the next action from stored state — not a model judgement |
| `src/schedule.ts` | SM-2 spaced repetition and mastery tracking |
| `src/graph.ts` | DAG validation, DOT/Mermaid emit, graphviz rendering |
| `src/view.ts` | Mastery bars, the progress card and the widget — layout, no colour |
| `src/mermaid.ts` | Mermaid blocks in files: extraction, and the fit-to-width decision |
| `src/store.ts` | LanceDB tables for profile, skills, nodes, lessons, quiz history |
| `src/embed.ts` | Local ONNX embeddings (Anthropic has no embeddings endpoint) |

The deliberate split: the model decides *how* to teach; `aby_next_action` decides
*what's next*. Review scheduling is arithmetic over dates, which is exactly what an
LLM drifts on over a long session.

### Tools

`aby_get_profile`, `aby_next_action`, `aby_set_goal`, `aby_record_assessment`,
`aby_upsert_roadmap`, `aby_render_roadmap`, `aby_save_lesson`, `aby_find_similar`,
`aby_record_quiz`, `aby_check`.

`aby_check` is the odd one out: it checks the tutor rather than the learner. Everything the
model asserts is otherwise graded against an answer key the same model wrote in the same turn,
so for quantitative subjects it discharges the claim against sympy first — `equivalent` for an
identity, `evaluate` for a number, `solve` for a solution set. It reports *verified*, *WRONG* or
*UNVERIFIED*, and the third is not the first: an equivalence sympy could not prove is reported
as unproven, never as confirmed. Missing interpreter or a timeout degrades the same way, so a
broken checker never blocks a lesson.

Tools reject bad input rather than absorbing it — `aby_upsert_roadmap` refuses
cycles, self-references, duplicate ids and prerequisites naming unknown nodes. The
model reads the error and corrects itself.

Re-proposing a roadmap **preserves** mastery and review state for any node id you
reuse, so revising the plan never wipes out progress.

## Data

Everything lives in one embedded LanceDB database at `~/.local/share/aby`
(override with `ABY_DATA_DIR`). Rendered graphs go to `.aby/roadmap.svg` and
`.aby/roadmap.dot` in the working directory.

## Development

```sh
pnpm check             # tsc --noEmit
pnpm test              # unit + integration tests
```

Tests cover the scheduler, DAG validation and rendering, the planner, and a real
LanceDB round-trip against a temp directory. None of them need an API key.

To load aby from another project instead of this one:

```sh
pi install /home/tom/Repo/aby     # or -l for project-local
```

## Notes for NixOS

`@lancedb/lancedb` and the ONNX embedding runtime ship prebuilt native `.node`
binaries. The dev shell exports `LD_LIBRARY_PATH` with `stdenv.cc.cc.lib`, `zlib` and
`openssl` so they can dlopen their dependencies; without it they fail to load even
with `nix-ld` enabled.

## License

MIT

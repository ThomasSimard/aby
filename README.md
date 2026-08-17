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
nix develop            # pi, node, pnpm, graphviz
pnpm install
pi                     # loads aby via .pi/settings.json
```

Then, in pi:

```
/assess rust           # interview to find your level
/roadmap               # build and render the graph
/learn                 # teach the next node
/quiz                  # test what should have stuck
/progress              # status report (no model call)
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

## How it works

| Piece | Role |
|---|---|
| `extensions/aby.ts` | Registers the nine `aby_*` tools and the five slash commands |
| `extensions/mermaid.ts` | `/mermaid` — draws a file's Mermaid diagrams in the transcript |
| `skills/tutor/SKILL.md` | The pedagogy: how to interview, scope nodes, teach and grade |
| `src/plan.ts` | Decides the next action from stored state — not a model judgement |
| `src/schedule.ts` | SM-2 spaced repetition and mastery tracking |
| `src/graph.ts` | DAG validation, DOT/Mermaid emit, graphviz rendering |
| `src/mermaid.ts` | Mermaid blocks in files: extraction, and the fit-to-width decision |
| `src/store.ts` | LanceDB tables for profile, skills, nodes, lessons, quiz history |
| `src/embed.ts` | Local ONNX embeddings (Anthropic has no embeddings endpoint) |

The deliberate split: the model decides *how* to teach; `aby_next_action` decides
*what's next*. Review scheduling is arithmetic over dates, which is exactly what an
LLM drifts on over a long session.

### Tools

`aby_get_profile`, `aby_next_action`, `aby_set_goal`, `aby_record_assessment`,
`aby_upsert_roadmap`, `aby_render_roadmap`, `aby_save_lesson`, `aby_find_similar`,
`aby_record_quiz`.

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

# task-flow-ai

**A coding agent that stops and asks before it writes.**

One agent doing everything carries two hundred messages of context and, halfway
through, has forgotten what it decided at the start. `task-flow-ai` splits the
work into six phases — each a fresh agent that reads only what the phase before
it wrote down, and hands you the plan before a single line of code is touched.

```
  intake  →  explore  →  plan  →  ⏸  →  implement  →  review  →  security
    ↓          ↓          ↓      you      ↓            ↓          ↓
  spec.md    map.md    plan.md  decide  report.md   review.md  security.md
                                          ↑______________|
                                       blocking findings, max 2 loops
```

Every phase leaves its artifact on disk in `.taskflow/runs/<id>/`. A run is
readable afterwards, argued with, and reused.

## Nothing here is tied to one agent

The six phases are six markdown files. The flow is one YAML file. Neither
mentions a vendor, a model or a product — they describe what has to happen, and
in what order.

Everything specific to a particular agent lives in exactly two places, and both
are additive: one adapter file per agent, and one install manifest per agent.
Adding support for another means adding those two files. It never means
changing a phase, the flow, or the code that runs them.

```
agents/*.md          the six phases          ← no vendor anywhere
pipelines/*.yaml     the flow                ← no vendor anywhere
src/                 the engine              ← no vendor anywhere
src/providers/       one file per agent      ← vendor lives only here
```

## Status

Built in the open. Here is exactly where it is:

| | | |
|---|---|---|
| Six-phase pipeline, artifacts on disk | **working** | |
| Plan approval before any code is written | **working** | asked in the terminal |
| Correction loop, review back to implement | **working** | max two rounds |
| Resuming an interrupted run | **working** | `run --resume last` |
| Writing confined to `write_paths` | **working** | checked after the phase, not prevented |
| Runs inside Claude Code, as a skill | **working** | the first agent supported |
| Runs standalone, as a CLI | in progress | loads and validates; cannot run a task yet |
| Runs inside Cursor, Gemini CLI, others | not yet | see *Adding your agent* below |
| Approve the plan from a browser dashboard | planned | the reason this project exists |
| Write permissions enforced, not requested | partly | enforced by the CLI, asked of a skill |

Rows that do not say **working** do not work yet. They are listed so you know
where this is going, not to suggest you can use them.

## Install

### Inside Claude Code

```bash
claude plugin marketplace add AleAlle62/task-flow-ai
claude plugin install task-flow-ai
```

Restart your session, then:

```
/task-flow-ai fix the empty cart bug
```

### Inside another agent

Not supported yet — not because it is hard, but because this project does not
announce an agent it has not actually run. If you use one, see *Adding your
agent*.

### As a standalone CLI

Not usable yet. When it is, it will run the same six phases against whichever
agent you point it at, with no chat and no editor involved:

```bash
task-flow-ai run "fix the empty cart bug"
```

## What happens

1. **intake** turns your request into a specification — requirements,
   assumptions, what is out of scope, how to check it is done.
2. **explore** reads the codebase and reports where things are and how they
   actually work. Read-only.
3. **plan** designs the change: approach, ordered steps, risks, verification.
4. **You decide.** The full plan is shown and the pipeline stops. Approve it,
   or reject it with a note. Nothing has been written yet.
5. **implement** executes the approved plan. It is the only phase that touches
   your code.
6. **review** rereads the diff for correctness, regressions and unnecessary
   complexity. Blocking findings send the work back — at most twice.
7. **security** checks the diff for vulnerabilities the change introduced.

## Who is allowed to write

Exactly one phase. It is declared in `agents/implement-ai.md`, on the `tools`
line, and the tool refuses to start if a second phase has a writing tool.

How strongly that is held depends on what is underneath:

- **The CLI** launches each phase without the writing tools existing at all. A
  read-only phase has no way to write, whatever it decides to do.
- **A skill** asks the host agent to respect it. Hosts generally do, but it is
  an instruction rather than a wall.
- **An agent that cannot restrict tools** makes the pipeline run read-only: the
  writing phase is skipped and you are told why. You still get the
  specification, the map, the plan and the review.

Which *paths* it may write is a separate rule, `write_paths` in the pipeline
file. That one is checked after the phase runs rather than prevented: no agent
CLI offers a reliable path whitelist, so the run fails and names every file that
was touched outside the fence. Those files are left exactly as they were
written — undoing your work on a guess would be worse than telling you.

## Make it yours

The six phases are six markdown files in [`agents/`](agents/). They are the
whole product — the code around them just puts them in order.

Do not like how the review phase judges severity? Edit
[`agents/review-ai.md`](agents/review-ai.md). Want a seventh phase for
performance? Write `agents/perf-ai.md` and add five lines to
[`pipelines/default.yaml`](pipelines/default.yaml). No code changes either way.

Any project can override a phase for itself by dropping its own copy in
`.taskflow/agents/<id>.md`.

## Adding your agent

Two files, and nothing else in the repository changes:

1. **An adapter** in `src/providers/`, implementing the contract in
   [`src/providers/types.ts`](src/providers/types.ts): run a phase, return its
   text, and say whether you can enforce the tool list.
2. **An install manifest** for that agent, alongside the existing
   `.claude-plugin/`.

One rule, and it is not negotiable: an agent is only listed once someone has
run the whole pipeline on it for real.

## License

MIT

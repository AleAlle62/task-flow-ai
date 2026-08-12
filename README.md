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

## Status

This project is being built in the open. Here is exactly where it is:

| | | |
|---|---|---|
| Six-phase pipeline as a Claude Code skill | **working** | install it below |
| Plan approval before any code is written | **working** | asked in chat |
| Artifacts on disk, one per phase | **working** | `.taskflow/runs/<id>/` |
| Correction loop, review back to implement | **working** | max two rounds |
| Approve the plan from a browser dashboard | planned | the reason this project exists |
| Standalone CLI, no Claude Code needed | planned | scaffolded, not usable yet |
| Other agents underneath (Codex, API) | planned | nothing built, nothing promised |
| Enforced write permissions | planned | today it is instruction, not enforcement |

Nothing in the "planned" rows works today. They are here so you know where this
is going, not to suggest you can use them.

## Install

```bash
claude plugin marketplace add AleAlle62/task-flow-ai
claude plugin install task-flow-ai
```

Restart your session, then:

```
/task-flow-ai fix the empty cart bug
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

## Make it yours

The six phases are six markdown files in [`agents/`](agents/). They are the
whole product — the code around them just puts them in order.

Do not like how the review phase judges severity? Edit
[`agents/review-ai.md`](agents/review-ai.md). Want a seventh phase for
performance? Write `agents/perf-ai.md` and add it to the list in
[`SKILL.md`](skills/task-flow-ai/SKILL.md).

## Why the browser matters

The plan approval currently happens in chat, which works but keeps you watching
a terminal. The point of this project is that you get asked in a browser page
instead: the pipeline runs, and when it needs you, a page shows you the plan and
waits. You approve from anywhere, and the phases behave identically no matter
which agent is underneath.

That part is not built yet. It is next.

## License

MIT

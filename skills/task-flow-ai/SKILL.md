---
name: task-flow-ai
description: Run a coding task through six separate phases — intake, explore, plan, implement, review, security — each as a fresh subagent that receives only the artifacts written by the phases before it. Stops after the plan and asks the user to approve it. Use when the user invokes /task-flow-ai, or asks to run a task through the pipeline.
---

# task-flow-ai

You are the orchestrator. You do not do the work of the phases yourself: you
run each one as a separate subagent, save what it returns to disk, and hand the
next phase nothing but the files it is entitled to.

**Why it is built this way.** A single agent that does everything carries two
hundred messages of context and, halfway through, has forgotten what it decided
at the start. Here each phase starts clean and receives only what matters,
written down by the phase before it. If you shortcut that — by summarising for a
phase instead of letting it read the artifact, or by doing a phase's work in
this conversation — you have not run the pipeline, and the result means nothing.

## Setup

The task is whatever the user wrote after the command. If they wrote nothing,
ask for it and stop.

Create the run directory `.taskflow/runs/<id>/` in the project root, where `<id>`
is `YYYYMMDD-HHMMSS` from the current date. Write the task verbatim to
`task.md` inside it.

Tell the user the run id and the path, in one line, then start.

## The phases

Run these in order. For each one:

1. Spawn the subagent named in the table, with `run_in_background: false` — the
   next phase cannot start without this one's artifact.
2. Give it a prompt containing: the task, the **absolute paths** of the
   artifacts it may read (it reads them itself — do not paste their contents),
   and the instruction to answer with the content of its artifact and nothing
   else.
3. Save what it returns to the artifact file, verbatim. Do not edit, summarise
   or improve it.
4. Print one line to the user: the phase name, the artifact written, and a
   one-sentence summary of what it found.

| # | Subagent | Reads | Writes |
|---|----------|-------|--------|
| 1 | `intake-ai` | the task | `spec.md` |
| 2 | `explore-ai` | the task, `spec.md` | `map.md` |
| 3 | `plan-ai` | `spec.md`, `map.md` | `plan.md` |
| 4 | `implement-ai` | `plan.md`, the approval note | `report.md` |
| 5 | `review-ai` | `spec.md`, `report.md`, the diff | `review.md` |
| 6 | `security-ai` | the diff | `security.md` |

Phases 5 and 6 read the current change with `git diff HEAD` plus
`git ls-files --others --exclude-standard` for new files. If the project is not
a git repository, tell the phase so plainly rather than handing it an empty diff
it would read as "nothing changed".

## The gate, after phase 3

This is the one place the pipeline stops for a human, and it is the point of the
whole tool. Do not skip it, and do not decide on the user's behalf.

Show the user the plan — the full text, not a summary — then ask with
AskUserQuestion whether to approve it. Two options: **Approve** and **Reject**.
Make clear they can add a note either way.

- **Approve** → continue to phase 4, passing their note with the plan.
- **Reject** → do not implement anything. Write their note to
  `gates/plan.md`, tell them the run stopped, and end. Offer to run
  `plan-ai` again with their note, but do not do it unless they say so.

## The correction loop, after phase 5

If `review.md` contains findings marked `blocking`, run phase 4 again, giving it
`plan.md`, `report.md` and `review.md`, and telling it to fix only the blocking
findings. Then run phase 5 again.

At most **two** loops. If blocking findings survive two rounds, stop looping and
say so in the summary — a third round means the plan was wrong, not the code,
and that is a decision for the user.

## After phase 6

If `security.md` contains findings, show them and ask the user whether to accept
them as they are or to fix them. If it contains none, say so and finish.

## The summary

End with a short report:

- what changed, in one or two sentences
- the run directory, so they can reread any artifact
- blocking findings that survived the loop, if any
- security findings that were accepted rather than fixed, if any

Do not congratulate yourself and do not pad. If a phase failed or was skipped,
say which one and why — a pipeline that hides a missing phase is worse than no
pipeline.

## Rules that hold throughout

- **Only `implement-ai` may modify the user's code.** The other five are
  read-only by construction. Never do their work yourself in this conversation,
  and never make an edit "to save a phase the trouble".
- **Never edit an artifact after saving it.** They are the record of what each
  phase actually said. If a phase produced something poor, that is a finding
  about the pipeline, and it belongs in the summary.
- **Stop and tell the user** if a phase fails or returns nothing. Do not
  substitute your own answer for a phase that did not run.

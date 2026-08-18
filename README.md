# task-flow-ai

**A coding agent that stops and asks before it writes.**

One agent doing everything carries two hundred messages of context and, halfway
through, has forgotten what it decided at the start. `task-flow-ai` splits the
work into six phases. Each one is a fresh agent that reads only what the phase
before it wrote down — and the whole thing stops and shows you the plan before a
single line of your code is touched.

```
  intake  →  explore  →  plan  →  ⏸  →  implement  →  review  →  security
    ↓          ↓          ↓      you      ↓            ↓          ↓
  spec.md    map.md    plan.md  decide  report.md   review.md  security.md
                                          ↑______________|
                                       blocking findings, max 2 rounds
```

Only **implement** can change your code. The other five can read your project
and nothing else — not by instruction, but because they are never handed a tool
that writes.

Every phase leaves its file in `.taskflow/runs/<id>/`, so a run can be reread
tomorrow, argued with, and resumed after a crash.

## Install

Needs [Claude Code](https://claude.com/claude-code) installed and signed in, and
Node 20 or newer.

```bash
git clone https://github.com/AleAlle62/task-flow-ai
cd task-flow-ai
npm install && npm run build && npm link
```

Or run it inside Claude Code as a plugin instead:

```bash
claude plugin marketplace add AleAlle62/task-flow-ai
```

## Use it

There is one command. Go to your project and run it:

```bash
task-flow-ai run
```

Your browser opens, you type what needs doing, and the run starts. From then on
the page shows the six phases across the top, which one is working, and what it
has cost so far in time, tokens and money. The plan waits for you there.

If you would rather say it up front, say it:

```bash
task-flow-ai run "fix the empty cart bug"
```

That is the whole surface. One option exists, for when you want the phases on a
cheaper or a stronger model:

```bash
task-flow-ai run --model claude-haiku-4-5
```

Everything else the command works out for itself:

| | |
| --- | --- |
| An unfinished run in this project | it offers to continue it, so you do not pay twice for the phases that finished |
| Port `4179` already busy | it takes a free one |
| No browser, or no way to open one | it asks in the terminal instead |
| A `.taskflow/pipeline.yaml` in your project | it uses that instead of the packaged flow |

Before anything runs it prints the flow it is about to follow — every phase,
what it reads, what it may do, where it stops — so you can read what is about to
be allowed before it happens.

Inside Claude Code, the plugin gives you the same pipeline as a command:

```
/task-flow-ai fix the empty cart bug
```

## What each phase does

1. **intake** turns your request into a specification — requirements, assumptions, what is out of scope, how to tell it is done.
2. **explore** reads the codebase and reports where things are and how they actually work.
3. **plan** designs the change: approach, ordered steps, risks, how to verify it.
4. **You decide.** The full plan is shown and the run stops. Approve it, or reject it with a note. Nothing has been written yet.
5. **implement** carries out the approved plan. The only phase that touches your code.
6. **review** rereads the diff for correctness, regressions and needless complexity. Blocking findings send the work back to implement — at most twice.
7. **security** checks the diff for vulnerabilities the change introduced, then stops for you a second time.

## Before you rely on it

Written plainly, so you find out here rather than later:

- **It runs on Claude Code and nothing else.** The engine is written against a
  provider contract with one implementation. Another agent means writing an
  adapter — see below.
- **It needs a working sandbox.** If Claude Code cannot start one on your
  machine, the run stops instead of going ahead without it. That is deliberate:
  the sandbox is where "no network, no credentials" is actually enforced.
- **A project's own `.taskflow/` files are not used unless you say so.** They
  decide which phases run and what each is told to do, and they arrive with the
  repository, so the run names them and asks first.
- **`write_paths` is checked after the fact, not enforced.** No agent CLI offers
  a reliable path whitelist, so a run that wrote outside its fence fails and
  names every file. Those files are left exactly as they were written. Changes
  you had already made before the run are not counted against it.
- **The dashboard is for your machine only.** It binds to `127.0.0.1` and is not
  meant to be exposed to a network.
- **Version 0.1.0.** The pipeline works end to end; the details around it still
  move.

---

# The longer version

Everything above is enough to use it. The rest is for reading the code.

## Who is allowed to write, and how it is held

Exactly one phase. It is declared in `agents/implement-ai.md` on the
`capabilities` line, and the tool refuses to start if a second phase holds a
capability that can change your code.

There are five capabilities, and no product's tool names appear among them:

| | |
| --- | --- |
| `read` | open files in the project |
| `search` | find files and text across the project |
| `inspect` | run read-only commands — git history, grep, listing |
| `execute` | run any command — **changes your code** |
| `write` | create and modify files — **changes your code** |

`execute` counts as writing because it *is* writing: `echo x > file` changes your
project exactly as much as an editor does. Counting only the obvious file-writing
tools is how a pipeline ends up with five "read-only" phases that can all rewrite
your repository.

A phase that only needs git history asks for `inspect`, which a provider may
offer only if it can hold the command list down to commands that look and do not
touch. On Claude Code that is a fixed allowlist — `git log`, `git diff`, `rg`,
`ls`, `cat` and a dozen more. The conveniences are missing on purpose: `find`
takes `-delete`, `sed` takes `-i`, and `awk` writes files on its own.

The rule is checked in five separate places, at five different moments:

| When | Where | What it does |
| --- | --- | --- |
| when you write it | `agents/*.md` | declares what a phase may do |
| before anything runs | `cli/pipeline/rules.ts` | refuses a pipeline with two writing phases |
| while it runs | `cli/providers/` | the agent is handed no tool that writes |
| around every command | `cli/providers/claude-sandbox.ts` | the walls below |
| after it writes | `cli/run/phases/write-paths.ts` | names files touched outside `write_paths` |

The first four prevent. The last one only reports.

### The walls around a shell

Deciding *which commands* a phase may run says nothing about what those
commands can reach once they are running. So every phase runs inside Claude
Code's sandbox, with three things shut off:

- **No network.** Not a domain allowlist with a few holes in it — an empty one.
  No phase in this pipeline has any business making a request, and this is what
  turns "a phase was talked into running curl" from a breach into a failed
  command.
- **No credentials.** `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.netrc`, cloud and
  registry configs: reads are refused. The `inspect` capability grants `cat` and
  `grep`, and those say nothing about *where* — without this, a phase described
  as read-only could copy your private key into an artifact.
- **No changing how your machine starts.** Shell rc files, login items and the
  credential paths above cannot be written, whatever a phase was asked to do.

Two smaller settings matter as much: the agent cannot ask for a command to be
run outside the sandbox, and if the sandbox cannot start, the run stops rather
than continuing without it. A boundary that quietly turns itself off is worse
than no boundary, because you would still be trusting it.

Every one of these was checked by running it rather than by reading the
documentation — `curl` returns 200 without the sandbox and fails with it,
`cat ~/.ssh/known_hosts` comes back "Operation not permitted", and `echo` still
works, which is the part that makes the rest usable.

### What is still only as strong as your attention

The content of your project reaches the phases, and a file in it can contain
sentences addressed to the agent. Phases are told that everything quoted to them
is material and not instruction, and an artifact can no longer forge the
markers that separate the two — but the plan is where this ends up, and the
plan is the thing you approve. Read it. That is what the gate is for.

## Is there a backend?

There is, and it lives for exactly as long as your run does.

- **It is one process, started by `run` and gone when the run ends.** Nothing is
  installed, nothing listens between runs, and there is no account.
- **It binds to `127.0.0.1` only.** No other machine can reach it, by
  construction rather than by configuration.
- **It holds no database.** A run is a directory of plain files under
  `.taskflow/runs/<id>/` — one markdown file per phase, your gate answers, and
  an append-only event log.
- **Your code and your task never leave your machine**, except where they always
  were going: to the agent you already have installed and signed in, on the
  account you already pay for. This project adds no service of its own to send
  anything to.
- **A dropped connection does not end a run.** Failures are sorted by kind:
  a network blip or an overloaded API is tried again, twice, waiting longer each
  time; an expired session or an empty balance is reported at once, with what to
  do about it, because retrying those only makes you wait to hear the same
  thing. Whatever does end a run, the phases that finished are on disk and are
  not paid for twice.
- **Why it exists at all:** the pipeline has to stop and ask a person, and a
  terminal is a poor place to read a page-long plan and decide. The server is
  there to put that plan in a browser and carry one answer back. Turn it off and
  the pipeline is unchanged — it asks in the terminal instead.

So the "backend" is a local messenger between the part that runs phases and the
page you read them on. If that sounds slight, it is meant to: the less it is,
the less there is to trust.

## The dashboard, and the server behind it

`run` starts a small HTTP server and opens your browser at it. The page is where
you type the task, watch phases finish, read each artifact as it lands, and
answer the two gates.

- **Loopback only.** It listens on `127.0.0.1`, so it is not reachable from
  another machine.
- **A secret per run.** Every request must carry a token minted when the server
  starts, and it is compared in constant time. Loopback alone is not enough:
  any page open in your browser can also reach `127.0.0.1`, and without a secret
  it does not know, a random site could answer a gate — that is, approve a plan
  that then writes to your code.
- **The address carries a ticket, not the secret.** What the browser is opened
  at — which is also in your terminal, and in the arguments of the command that
  opened it, where anyone running `ps` can read it — works exactly once. The
  page trades it for the token, wipes the address, and the token itself never
  appears in an address bar or a process list. The terminal prints a fresh
  ticket every time the run asks you something.
- **A second lock on top of it.** A request whose `Origin` is some other site is
  refused before the token is even read.
- **An approval names what it is approving.** The answer to a gate carries the
  phase it belongs to, and is refused if that is not the question on the table.
  With two tabs open, a click meant for the plan cannot land on whatever was
  asked next.
- **Bodies are capped at a megabyte**, which is a great deal more than a typed
  sentence and a note.
- **Port 4179 when it is free**, any free port when it is not. A second run in
  another project is not an error.
- **It is optional.** If the dashboard cannot start at all, the run does not
  end — it asks in the terminal. Nothing in the pipeline is written differently
  because of where the question is asked.

The page talks to the CLI over a handful of endpoints — `GET /api/run` for the
state, `GET /api/events` for the live stream, `GET /api/artifact` for a phase's
output, `POST /api/gate` for your answer — and holds no logic of its own. Close
the browser and the run continues; the gate simply waits.

## A run on disk

Everything a run produces lands in `.taskflow/runs/<id>/` as plain files:

- one markdown file per phase, exactly what that phase returned
- `gates-<phase>.md`, your answer and your note
- `run.json`, which phases finished and what they cost
- `events.jsonl`, an append-only log of everything that happened

That is what makes continuing a run possible, and what lets something other than
this process watch one. Start the command again in a project with an unfinished
run and it offers to pick it up: nothing that finished is repeated, and a gate
you already answered is not asked twice.

## Make it yours

The six phases are six markdown files in [`agents/`](agents/). They are the
whole product — the code around them just puts them in order.

Do not like how review judges severity? Edit
[`agents/review-ai.md`](agents/review-ai.md). Want a seventh phase for
performance? Write `agents/perf-ai.md` and add five lines to
[`pipelines/default.yaml`](pipelines/default.yaml). No code changes either way.

Any project can override a phase for itself by dropping its own copy in
`.taskflow/agents/<id>.md`, or replace the flow entirely with its own
`.taskflow/pipeline.yaml`. Both are picked up because they are there — there is
no option to remember.

## Adding your agent

The engine talks to one interface, [`cli/providers/types.ts`](cli/providers/types.ts):
run a phase, return its text, translate the five capabilities into whatever your
agent calls them, and say how much of that list you can actually hold it to —
`tools` (the exact list is granted and nothing else), `read-only` (no per-tool
control, but a phase can be made unable to change anything) or `none` (nothing
can be held back, so the writing phase is skipped and you are told why).

One rule, and it is not negotiable: an agent is only listed here once someone has
run the whole pipeline on it for real. Which is why the list is currently one.

## How the repository is organised

| Folder | What it is |
| --- | --- |
| [`agents/`](agents/) | One markdown file per phase: the frontmatter declares what it may do, the body is its instructions. |
| [`pipelines/`](pipelines/) | One YAML file per pipeline: which phase runs when, what it reads, where it stops. |
| [`cli/`](cli/) | The engine. Reads those files, runs the phases, keeps the result. |
| [`web/`](web/) | The dashboard. Talks to the CLI over HTTP and nothing else. |
| [`skills/`](skills/) | The same pipeline offered as a skill to an agent that supports them. |
| [`docs/`](docs/) | The page below. |

Inside `cli/`: `model/` is the vocabulary everything agrees on, `errors/` decides what a failure is and whether trying again could help, `pipeline/` turns
your files into it and refuses them when they are wrong, `providers/` is the only
place a vendor's tool name is written down, `run/` executes a pipeline, and
`server/` is the dashboard's other half.

**[Read the illustrated map →](docs/index.html)** — the four areas, the flow, and
the boundary, drawn out. Open it locally, or publish it with GitHub Pages
(Settings → Pages → Source: `/docs`).

## License

MIT

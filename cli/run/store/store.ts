import fs from "node:fs";
import path from "node:path";

import type { PhaseUsage, RunState, RunStatus } from "../../model/run.js";
import { runsDir } from "../../paths.js";
import { ConfigError } from "../../util/guards.js";
import { EventLog } from "./events.js";
import * as records from "./records.js";
import { newRunId } from "./run-id.js";
import * as files from "./files.js";

/**
 * Everything a run produces, in one directory, in plain files.
 *
 * Phases never talk to each other — each writes a file and the next reads it.
 * That is what lets a run be reread tomorrow, resumed after a crash, and
 * watched by something that is not this process.
 */
/**
 * Whether a run can still be picked up. Absent means the directory holds no
 * run at all, which is not something to offer and not something to keep.
 */
function resumable(status: RunStatus | undefined): boolean {
  return status === "running" || status === "failed";
}

/**
 * Whether a run reached an end and may therefore be swept away.
 *
 * Stated as what it *is* rather than as "not resumable", because the two differ
 * on the case that matters: a directory holding no run at all is neither, and
 * this decides a `rm -rf`. Not offering to continue something we cannot read is
 * caution; deleting it would be the opposite.
 */
function hasEnded(status: RunStatus | undefined): boolean {
  return status === "done" || status === "stopped";
}

export class RunStore {
  readonly dir: string;
  readonly events: EventLog;

  private state: RunState;

  private constructor(dir: string, state: RunState) {
    this.dir = dir;
    this.state = state;
    this.events = new EventLog(path.join(dir, "events.jsonl"), state.id);
  }

  static create(options: {
    projectDir: string;
    task: string;
    pipeline: string;
    /** The phases the run means to reach, in order, so it can be drawn at once. */
    phases: { id: string; output: string }[];
  }): RunStore {
    const id = newRunId();
    const dir = files.createRunDirectory(options.projectDir, id);

    const store = new RunStore(dir, {
      id,
      task: options.task,
      projectDir: options.projectDir,
      pipeline: options.pipeline,
      status: "running",
      startedAt: new Date().toISOString(),
      totalCostUsd: 0,
      phases: options.phases.map((phase) => records.planned(phase.id, phase.output)),
    });

    store.writeArtifact("task.md", options.task);
    store.save();
    store.events.append("run_started", { task: options.task });

    return store;
  }

  /**
   * Reopens a run that was interrupted. Its artifacts and its event log are
   * still there, so the phases that finished are not paid for twice.
   */
  static open(projectDir: string, runId: string): RunStore {
    const dir = files.runDirectory(projectDir, runId);
    const state = files.readState(dir);

    if (!state) throw new ConfigError(`no run "${runId}" in ${runsDir(projectDir)}`);

    const store = new RunStore(dir, { ...state, projectDir, status: "running" });

    store.save();
    store.events.append("run_resumed", { from: state.status });

    return store;
  }

  /**
   * The most recent run worth offering to continue, if there is one.
   *
   * Only a run that was interrupted qualifies. A run you *stopped* — read the
   * plan, said no — reached its end as surely as one that finished: offering it
   * back meant being asked the same question at the start of every run in that
   * project forever, and saying yes only replayed the refusal off disk and
   * stopped again, without ever clearing the flag.
   *
   * A directory with no `run.json` is not a run at all — a half-deleted one, a
   * stray folder — and used to be offered anyway, which turned a yes into a
   * crash.
   */
  static lastUnfinished(projectDir: string): string | undefined {
    return files
      .listRunIds(projectDir)
      .find((id) => resumable(files.readState(files.runDirectory(projectDir, id))?.status));
  }

  /**
   * Removes finished runs beyond the most recent `keep`, oldest first.
   *
   * Finished means reached an end, which includes the ones you stopped: saying
   * no to a plan is an outcome, and a run left out of every sweep because of it
   * is a directory that only ever accumulates. A run still running or failed
   * mid-way is never touched, however old — it may be the one thing someone
   * means to resume. Returns the ids removed, newest first.
   */
  static prune(projectDir: string, keep: number): string[] {
    const finished = files
      .listRunIds(projectDir)
      .filter((id) => hasEnded(files.readState(files.runDirectory(projectDir, id))?.status));

    const toRemove = finished.slice(keep);

    for (const id of toRemove) files.removeRunDirectory(projectDir, id);

    return toRemove;
  }

  get current(): Readonly<RunState> {
    return this.state;
  }

  // Artifacts

  artifactPath(name: string): string {
    return path.join(this.dir, name);
  }

  hasArtifact(name: string): boolean {
    return fs.existsSync(this.artifactPath(name));
  }

  readArtifact(name: string): string {
    return fs.readFileSync(this.artifactPath(name), "utf8");
  }

  writeArtifact(name: string, content: string): void {
    const text = content.endsWith("\n") ? content : `${content}\n`;
    fs.writeFileSync(this.artifactPath(name), text, "utf8");
  }

  // Progress

  /** A phase is finished when it said so and its artifact is still on disk. */
  isPhaseComplete(id: string, output: string): boolean {
    return records.find(this.state.phases, id)?.status === "done" && this.hasArtifact(output);
  }

  startPhase(id: string, output: string): void {
    this.commit(records.replace(this.state.phases, records.started(id, output)));
    this.events.append("phase_started", { phase: id });
  }

  finishPhase(id: string, usage: PhaseUsage = {}): void {
    const record = records.completed(this.requirePhase(id), usage);

    this.state.totalCostUsd += usage.costUsd ?? 0;
    this.commit(records.replace(this.state.phases, record));

    this.events.append("phase_finished", {
      phase: id,
      durationMs: record.durationMs,
      costUsd: record.costUsd,
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
    });
  }

  failPhase(id: string, reason: string): void {
    const record = records.failed(this.requirePhase(id), reason);

    this.commit(records.replace(this.state.phases, record));
    this.events.append("phase_failed", { phase: id, error: reason });
  }

  finish(status: RunStatus): void {
    this.state.status = status;
    this.state.endedAt = new Date().toISOString();

    this.save();
    this.events.append("run_finished", { status, totalCostUsd: this.state.totalCostUsd });
  }

  /**
   * Only reachable if the orchestrator finishes a phase it never started, which
   * is our bug rather than anything a user can cause.
   */
  private requirePhase(id: string) {
    const record = records.find(this.state.phases, id);

    if (!record) throw new Error(`phase "${id}" was never started in run ${this.state.id}`);

    return record;
  }

  private commit(phases: RunState["phases"]): void {
    this.state.phases = phases;
    this.save();
  }

  private save(): void {
    files.writeState(this.dir, this.state);
  }
}

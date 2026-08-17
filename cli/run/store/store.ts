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

  /** The most recent run that never reached an end, if there is one. */
  static lastUnfinished(projectDir: string): string | undefined {
    return files
      .listRunIds(projectDir)
      .find((id) => files.readState(files.runDirectory(projectDir, id))?.status !== "done");
  }

  get id(): string {
    return this.state.id;
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

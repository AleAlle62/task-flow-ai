import fs from "node:fs";
import path from "node:path";

import type { PhaseRecord, RunState, RunStatus } from "../model/run.js";
import { runsDir } from "../paths.js";
import { EventLog } from "./events.js";
import { newRunId } from "./run-id.js";

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

  static create(options: { projectDir: string; task: string; pipeline: string }): RunStore {
    const id = newRunId();
    const dir = path.join(runsDir(options.projectDir), id);

    fs.mkdirSync(dir, { recursive: true });
    ignoreOurselves(options.projectDir);

    const store = new RunStore(dir, {
      id,
      task: options.task,
      projectDir: options.projectDir,
      pipeline: options.pipeline,
      status: "running",
      startedAt: new Date().toISOString(),
      totalCostUsd: 0,
      phases: [],
    });

    store.writeArtifact("task.md", options.task);
    store.save();
    store.events.append("run_started", { task: options.task });

    return store;
  }

  get id(): string {
    return this.state.id;
  }

  get current(): Readonly<RunState> {
    return this.state;
  }

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

  startPhase(id: string, output: string): void {
    const record: PhaseRecord = {
      id,
      status: "running",
      output,
      startedAt: new Date().toISOString(),
    };

    this.state.phases = [...this.state.phases.filter((phase) => phase.id !== id), record];
    this.save();
    this.events.append("phase_started", { phase: id });
  }

  finishPhase(id: string, result: { costUsd?: number } = {}): void {
    const record = this.requirePhase(id);

    record.status = "done";
    record.endedAt = new Date().toISOString();
    record.durationMs = elapsed(record);

    if (result.costUsd !== undefined) {
      record.costUsd = result.costUsd;
      this.state.totalCostUsd += result.costUsd;
    }

    this.save();
    this.events.append("phase_finished", {
      phase: id,
      durationMs: record.durationMs,
      costUsd: record.costUsd,
    });
  }

  failPhase(id: string, reason: string): void {
    const record = this.requirePhase(id);

    record.status = "failed";
    record.endedAt = new Date().toISOString();
    record.durationMs = elapsed(record);
    record.error = reason;

    this.save();
    this.events.append("phase_failed", { phase: id, error: reason });
  }

  finish(status: RunStatus): void {
    this.state.status = status;
    this.state.endedAt = new Date().toISOString();

    this.save();
    this.events.append("run_finished", {
      status,
      totalCostUsd: this.state.totalCostUsd,
    });
  }

  /**
   * Only reachable if the orchestrator finishes a phase it never started, which
   * is our bug rather than anything a user can cause.
   */
  private requirePhase(id: string): PhaseRecord {
    const record = this.state.phases.find((phase) => phase.id === id);

    if (!record) {
      throw new Error(`phase "${id}" was never started in run ${this.state.id}`);
    }

    return record;
  }

  private save(): void {
    fs.writeFileSync(
      path.join(this.dir, "run.json"),
      `${JSON.stringify(this.state, null, 2)}\n`,
      "utf8",
    );
  }
}

function elapsed(record: PhaseRecord): number | undefined {
  if (!record.startedAt || !record.endedAt) return undefined;
  return Date.parse(record.endedAt) - Date.parse(record.startedAt);
}

/**
 * Runs are working files, like logs: they stay on the machine that made them.
 * Writing this once means nobody has to remember to edit their own .gitignore,
 * and nothing a phase read reaches a pull request by accident.
 */
function ignoreOurselves(projectDir: string): void {
  const taskflowDir = path.join(projectDir, ".taskflow");
  const gitignore = path.join(taskflowDir, ".gitignore");

  if (fs.existsSync(gitignore)) return;

  fs.mkdirSync(taskflowDir, { recursive: true });
  fs.writeFileSync(
    gitignore,
    "# Runs are local working files. Delete this to commit them instead.\n*\n!.gitignore\n",
    "utf8",
  );
}

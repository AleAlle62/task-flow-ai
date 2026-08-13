/** What a run is while it happens, and what is left of it on disk afterwards. */

export type PhaseStatus = "pending" | "running" | "done" | "failed";

/** One phase's progress. `error` is set only when it failed, and is the reason. */
export interface PhaseRecord {
  id: string;
  status: PhaseStatus;
  output: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  costUsd?: number;
  error?: string;
}

/**
 * "stopped" is a person rejecting a plan. It is an outcome, not a failure —
 * the pipeline did exactly what it exists to do.
 */
export type RunStatus = "running" | "done" | "failed" | "stopped";

/**
 * The contents of `run.json`: enough to reread a run tomorrow, and enough to
 * resume one that died halfway.
 */
export interface RunState {
  id: string;
  task: string;
  projectDir: string;
  pipeline: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  totalCostUsd: number;
  phases: PhaseRecord[];
}

/**
 * One line of `events.jsonl`. Append-only and never rewritten: it is the record
 * of what happened, in order, and what the dashboard will read.
 */
export interface RunEvent {
  ts: string;
  run: string;
  type: string;
  [key: string]: unknown;
}

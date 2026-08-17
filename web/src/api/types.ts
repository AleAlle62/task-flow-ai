/**
 * The shapes the server sends.
 *
 * Declared here rather than imported from the CLI on purpose: the dashboard
 * depends on the HTTP contract, not on how the CLI happens to model a run
 * inside itself. If the two ever drift, it should be visible here as a wrong
 * field, not invisible as a shared type quietly changing underneath.
 */

export type PhaseStatus = "pending" | "running" | "done" | "failed";

export type RunStatus = "running" | "done" | "failed" | "stopped";

export interface PhaseRecord {
  id: string;
  status: PhaseStatus;
  output: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

/**
 * A phase as it is known before the run exists: from the pipeline file, not
 * from anything that has happened. It is what lets the first screen show what
 * is about to happen, and which phase will be allowed to write, while you are
 * still deciding whether to ask for it.
 */
export interface PlannedPhase {
  id: string;
  output: string;
  canWrite: boolean;
}

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

/** The question a run is currently stopped on, or null when it is not stopped. */
export interface PendingGate {
  phase: string;
  artifact: string;
  text: string;
  options: string[];
}

export interface RunEvent {
  ts: string;
  run: string;
  type: string;
  [key: string]: unknown;
}

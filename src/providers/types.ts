/**
 * What an agent has to be able to do for this pipeline to work.
 *
 * This file is the whole "any agent underneath" promise. Everything above it —
 * phases, artifacts, gates — is written against this contract and nothing else,
 * so a second provider means one new file here and no changes anywhere.
 */

/**
 * One phase, ready to run. `instructions` is the body of `agents/<id>.md`,
 * `input` is the task plus the artifacts this phase is entitled to read, and
 * `model` is left undefined when the user has not chosen one.
 */
export interface PhaseRequest {
  instructions: string;
  input: string;
  tools: string[];
  canWrite: boolean;
  cwd: string;
  timeoutMs: number;
  model?: string;
}

/** What came back. `text` becomes the phase's artifact; `raw` is for debugging. */
export interface PhaseResult {
  text: string;
  costUsd?: number;
  durationMs?: number;
  raw?: unknown;
}

/**
 * `enforcesTools` says whether this provider can actually stop a phase from
 * using a tool it was not given. When it is false the pipeline runs read-only:
 * the writing phase is skipped and the user is told why. "Only one phase can
 * write" has to be enforced by the machine, or it is a label on a file.
 *
 * `preflight` fails with an actionable message when the provider is not usable
 * — missing binary, expired session, no credentials. It runs once before the
 * first phase, so a run does not die four phases in.
 */
export interface Provider {
  readonly id: string;
  readonly enforcesTools: boolean;
  preflight(): Promise<void>;
  run(request: PhaseRequest): Promise<PhaseResult>;
}

/** Thrown when a provider cannot do its job. Not the user's file being wrong. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

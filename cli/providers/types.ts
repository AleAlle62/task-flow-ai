/**
 * What an agent has to be able to do for this pipeline to work.
 *
 * This file is the whole "any agent underneath" promise. Everything above it —
 * phases, artifacts, gates — is written against this contract and nothing else,
 * so a second provider means one new file here and no changes anywhere.
 */

import type { Capability } from "../model/capabilities.js";

/**
 * One phase, ready to run. `instructions` is the body of `agents/<id>.md`,
 * `input` is the task plus the artifacts this phase is entitled to read, and
 * `model` is left undefined when the user has not chosen one.
 *
 * `capabilities` is what the phase may do, in this tool's own words. Turning
 * them into tool names, flags or permission rules is the provider's job and
 * nobody else's — that translation is the only thing a provider file contains
 * that could not be written without knowing the product.
 */
export interface PhaseRequest {
  instructions: string;
  input: string;
  capabilities: Capability[];
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
 * How much of the capability list a provider can actually hold a phase to.
 *
 * It was a boolean once, and the boolean was wrong in both directions: it made
 * "cannot pin the exact tool list" mean "cannot be trusted with anything", so an
 * agent whose only control is a global read-only switch had its writing phase
 * skipped and produced a pipeline that never wrote a line — while an agent with
 * no controls at all was refused in the same breath, as though the two were the
 * same risk.
 *
 * - `tools`     the exact capability list is granted and nothing else.
 * - `read-only` no per-capability control, but a phase can be made unable to
 *               change anything. That is all this pipeline actually needs: the
 *               one phase allowed to write is allowed to write anyway.
 * - `none`      nothing can be held back. The writing phase is skipped and the
 *               user is told why, because "only one phase writes" enforced by
 *               nothing is a label on a file.
 */
export type Enforcement = "tools" | "read-only" | "none";

/**
 * `preflight` fails with an actionable message when the provider is not usable
 * — missing binary, expired session, no credentials. It runs once before the
 * first phase, so a run does not die four phases in.
 */
export interface Provider {
  readonly id: string;
  readonly enforcement: Enforcement;
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

/**
 * The vocabulary of the tool: the shapes every other file agrees on.
 * Nothing here reads a file or validates anything.
 */

import type { Capability } from "./capabilities.js";

/** A stop where a human decides. Declared now, honoured from step 2. */
export interface Gate {
  show?: string;
  when?: "always" | "findings";
  options: string[];
}

/** What happens when a phase reports findings it considers blocking. */
export interface FindingsPolicy {
  severity: string[];
  goto: string;
  maxLoops: number;
}

/**
 * A phase file in `agents/`, once read. `capabilities` is the security boundary
 * of the whole tool, not a preference: it is what stops a phase from writing.
 *
 * The same files also carry a `tools:` line, which some agents read when they
 * load them as their own subagent definitions. This tool ignores it: what a
 * phase may do is decided here and enforced by the provider.
 */
export interface Agent {
  id: string;
  description: string;
  capabilities: Capability[];
  prompt: string;
  file: string;
}

/** One step of the pipeline. Its `id` is also the name of its file in `agents/`. */
export interface Phase {
  id: string;
  inputs: string[];
  output: string;
  timeout?: number;
  gate?: Gate;
  findingsPolicy?: FindingsPolicy;
  agent: Agent;
  canWrite: boolean;
}

/**
 * The flow, and only the flow: which phase runs when, what it reads, what it
 * writes, where it stops. It deliberately says nothing about which agent,
 * provider or model runs underneath — those belong to whoever runs it.
 */
export interface Pipeline {
  defaults: { timeout: number };
  writePaths: string[];
  phases: Phase[];
  source: string;
}

/** Inputs computed by the tool rather than produced by an earlier phase. */
export const COMPUTED_INPUTS = ["task", "diff"] as const;

/** Prefix of a note left by a human at a gate, e.g. `gates.plan-ai.note`. */
export const GATE_INPUT_PREFIX = "gates.";

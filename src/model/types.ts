/**
 * The vocabulary of the tool. Nothing in here reads a file or validates
 * anything — these are the shapes the rest of the code agrees on.
 */

/** A stop where a human decides. Declared now, honoured from step 2. */
export interface Gate {
  /** Artifact to show the person deciding. */
  show?: string;
  /** "findings" stops only when the phase reported something. */
  when?: "always" | "findings";
  options: string[];
}

/** What happens when a phase reports findings it considers blocking. */
export interface FindingsPolicy {
  severity: string[];
  goto: string;
  maxLoops: number;
}

/** A phase file in `agents/`, once read. */
export interface Agent {
  id: string;
  description: string;
  /** What this phase may do. The security boundary, not a preference. */
  tools: string[];
  /** The instructions, without the frontmatter. */
  prompt: string;
  /** Where it was read from, so errors can point at it. */
  file: string;
}

export interface Phase {
  /** Also the name of the file in `agents/`. */
  id: string;
  inputs: string[];
  output: string;
  timeout?: number;
  gate?: Gate;
  findingsPolicy?: FindingsPolicy;
  agent: Agent;
  /** Derived from the agent's tools: whether it can modify the user's files. */
  canWrite: boolean;
}

/**
 * The flow, and only the flow. Which phase runs when, what it reads, what it
 * writes, where it stops. Deliberately says nothing about which agent or model
 * runs underneath: those are the user's choice, not the pipeline's.
 */
export interface Pipeline {
  defaults: { timeout: number };
  /** Globs the writing phase is confined to, relative to the target project. */
  writePaths: string[];
  phases: Phase[];
  /** The file it came from, for error messages. */
  source: string;
}

/** Inputs that are computed rather than produced by an earlier phase. */
export const COMPUTED_INPUTS = ["task", "diff"] as const;

/** A note left by a human at a gate, e.g. `gates.plan-ai.note`. */
export const GATE_INPUT_PREFIX = "gates.";

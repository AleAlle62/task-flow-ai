import { ClaudeCliProvider } from "./claude-cli.js";
import type { Provider } from "./types.js";

/**
 * Which agent runs underneath.
 *
 * One, deliberately. There was a registry here, and a branch for choosing
 * between several, and a `--provider` option named in its error message —
 * all of it reachable only if a second entry ever appeared, and none of it
 * exercised by anything. A choice nobody can make is not a choice.
 *
 * The seam that matters is `types.ts`, not this file: everything above it is
 * written against the `Provider` contract, so a second agent is a new file
 * there and a line here, and nothing else moves. The project's rule stands —
 * nothing appears here before it has been run for real.
 */
export function resolveProvider(): Provider {
  return new ClaudeCliProvider();
}

export type { Enforcement, PhaseRequest, PhaseResult, Provider } from "./types.js";
export { ProviderError } from "./types.js";

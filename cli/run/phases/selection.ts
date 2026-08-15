import type { Phase, Pipeline } from "../../model/types.js";
import type { Provider } from "../../providers/index.js";

export interface RunnablePhases {
  phases: Phase[];
  /** Phases dropped because the provider cannot be trusted to hold them back. */
  skipped: Phase[];
}

/**
 * Which phases this provider is allowed to run.
 *
 * Only a provider that can hold nothing back loses the writing phase. One that
 * merely cannot pin the exact capability list — but can still make a phase
 * unable to change anything — runs everything: the phase that would have been
 * skipped is the one allowed to write in the first place, so there is nothing
 * left to protect it from.
 *
 * When the writing phase does go, everything read-only still produces something
 * worth having, and the caller is expected to say so out loud.
 */
export function selectRunnablePhases(pipeline: Pipeline, provider: Provider): RunnablePhases {
  if (provider.enforcement !== "none") return { phases: pipeline.phases, skipped: [] };

  const skipped = pipeline.phases.filter((phase) => phase.canWrite);

  if (skipped.length === 0) return { phases: pipeline.phases, skipped: [] };

  return { phases: pipeline.phases.filter((phase) => !phase.canWrite), skipped };
}

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
 * A provider that cannot restrict tools cannot be trusted with the writing
 * phase, so the run happens without it. Everything read-only still produces
 * something worth having, and the caller is expected to say so out loud.
 */
export function selectRunnablePhases(pipeline: Pipeline, provider: Provider): RunnablePhases {
  if (provider.enforcesTools) return { phases: pipeline.phases, skipped: [] };

  const skipped = pipeline.phases.filter((phase) => phase.canWrite);

  if (skipped.length === 0) return { phases: pipeline.phases, skipped: [] };

  return { phases: pipeline.phases.filter((phase) => !phase.canWrite), skipped };
}

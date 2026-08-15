import type { RunStatus } from "../../model/run.js";
import type { Phase } from "../../model/types.js";
import { errorMessage } from "../../util/guards.js";
import type { RunContext } from "../context.js";
import { buildPhaseInput, type Correction } from "../inputs/build.js";

/**
 * The result of one phase.
 *
 * Deliberately not `string | RunStatus`: both sides of that union are strings,
 * so a caller cannot tell an artifact from a failure, and a broken phase sails
 * on as if it had produced something. That bug shipped once already.
 */
export type PhaseOutcome =
  | { ok: true; artifact: string; costUsd?: number }
  | { ok: false; status: RunStatus; reason: string };

/**
 * Runs one phase and records what happened. It knows how to ask a provider and
 * how to store the answer; it decides nothing about what comes next.
 */
export async function executePhase(
  phase: Phase,
  context: RunContext,
  correction?: Correction,
): Promise<PhaseOutcome> {
  const { store } = context;

  store.startPhase(phase.id, phase.output);

  try {
    const result = await context.provider.run({
      instructions: phase.agent.prompt,
      input: buildPhaseInput(phase, store, context.projectDir, correction),
      capabilities: phase.agent.capabilities,
      canWrite: phase.canWrite,
      cwd: context.projectDir,
      timeoutMs: timeoutMs(phase, context),
      ...(context.model ? { model: context.model } : {}),
    });

    store.writeArtifact(phase.output, result.text);
    store.finishPhase(phase.id, result.costUsd);

    return {
      ok: true,
      artifact: result.text,
      ...(result.costUsd === undefined ? {} : { costUsd: result.costUsd }),
    };
  } catch (err) {
    const reason = errorMessage(err);

    store.failPhase(phase.id, reason);
    store.finish("failed");

    return { ok: false, status: "failed", reason };
  }
}

export function phaseDurationMs(phase: Phase, context: RunContext): number {
  const record = context.store.current.phases.find((entry) => entry.id === phase.id);
  return record?.durationMs ?? 0;
}

function timeoutMs(phase: Phase, context: RunContext): number {
  return (phase.timeout ?? context.pipeline.defaults.timeout) * 1000;
}

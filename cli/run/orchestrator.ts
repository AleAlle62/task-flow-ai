import type { RunStatus } from "../model/run.js";
import type { Phase } from "../model/types.js";
import type { RunContext } from "./context.js";
import { decideCorrection, type LoopCounter } from "./phases/corrections.js";
import { passGate, type GateOutcome } from "./gates/runner.js";
import type { Correction } from "./inputs/build.js";
import { executePhase, phaseDurationMs } from "./phases/runner.js";
import * as report from "./reporting.js";
import { selectRunnablePhases } from "./phases/selection.js";
import { filesOutside } from "./phases/write-paths.js";

/**
 * The order phases happen in, and nothing else.
 *
 * Three things bend the straight line: a gate stops it for a person, a review
 * with blocking findings sends it backwards, and a resumed run skips what is
 * already on disk. Each of those lives in its own file — this one only decides
 * which happens next.
 */
export async function runPipeline(context: RunContext): Promise<RunStatus> {
  const { phases, skipped } = selectRunnablePhases(context.pipeline, context.provider);

  if (skipped.length > 0) report.providerCannotWrite(context.provider.id, skipped);

  const loops: LoopCounter = new Map();

  let index = 0;
  let correction: Correction | undefined;

  while (index < phases.length) {
    const phase = phases[index] as Phase;

    if (canSkip(phase, context, correction)) {
      report.phaseSkipped(phase.id);

      if ((await gateOf(phase, context)) === "stopped") {
        report.stopped(phase.id);
        return "stopped";
      }

      index++;
      continue;
    }

    report.phaseStarting(index, phases.length, phase.id);

    const outcome = await executePhase(phase, context, correction);

    if (!outcome.ok) {
      report.phaseFailed(outcome.reason);
      return outcome.status;
    }

    correction = undefined;
    report.phaseDone(phase.output, phaseDurationMs(phase, context), outcome.costUsd);

    if (phase.canWrite && !withinWritePaths(phase, context)) return "failed";

    if ((await passGate(phase, outcome.artifact, context)) === "stopped") {
      report.stopped(phase.id);
      return "stopped";
    }

    const decision = decideCorrection(phase, outcome.artifact, phases, loops);

    if (decision.kind === "exhausted") {
      report.loopExhausted(phase.id, phase.output, decision.rounds);
    }

    if (decision.kind === "retry") {
      report.sendingBack(phase.id, phases[decision.index]?.id ?? "", decision.round, decision.of);
      correction = decision.correction;
      index = decision.index;
      continue;
    }

    index++;
  }

  return "done";
}

/** A resumed run repeats nothing that finished and left its artifact behind. */
function canSkip(phase: Phase, context: RunContext, correction?: Correction): boolean {
  return (
    context.resuming &&
    correction === undefined &&
    context.store.isPhaseComplete(phase.id, phase.output)
  );
}

/**
 * A skipped phase still has to clear its gate.
 *
 * Finishing a phase and answering the gate that follows it are two events, and a
 * run interrupted between them had done the first and not the second. Skipping
 * the phase and its gate together let that gap through: the artifact was on
 * disk, so the phase looked done, so nobody was ever asked — and the phase
 * allowed to write started on a plan no human had approved.
 *
 * Asking again is not a risk here. `passGate` reads the answer off disk when
 * there is one, so a gate already answered stays answered.
 */
function gateOf(phase: Phase, context: RunContext): Promise<GateOutcome> {
  return passGate(phase, context.store.readArtifact(phase.output), context);
}

/**
 * The writing phase is checked against `write_paths` after it runs. Files it
 * touched outside them are left exactly as they are and named: undoing
 * someone's work automatically is worse than telling them about it.
 */
function withinWritePaths(phase: Phase, context: RunContext): boolean {
  const outside = filesOutside(context.projectDir, context.pipeline.writePaths);
  if (outside.length === 0) return true;

  context.store.events.append("write_paths_violated", { phase: phase.id, files: outside });
  context.store.finish("failed");

  report.wroteOutside(phase.id, outside, context.pipeline.writePaths);

  return false;
}

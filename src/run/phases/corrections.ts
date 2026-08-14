import type { Phase } from "../../model/types.js";
import { hasFindings } from "./findings.js";
import type { Correction } from "../inputs/build.js";

/**
 * What to do about a phase that reported findings. Pure: it reads text and
 * returns a decision, so the rule can be understood, and later tested, without
 * a provider, a run directory or a terminal.
 */
export type CorrectionDecision =
  | { kind: "none" }
  | { kind: "retry"; index: number; correction: Correction; round: number; of: number }
  | { kind: "exhausted"; rounds: number };

/** Rounds already spent sending work back, per phase. */
export type LoopCounter = Map<string, number>;

export function decideCorrection(
  phase: Phase,
  artifact: string,
  phases: Phase[],
  loops: LoopCounter,
): CorrectionDecision {
  const policy = phase.findingsPolicy;

  if (!policy || !hasFindings(artifact, policy.severity)) return { kind: "none" };

  const index = phases.findIndex((candidate) => candidate.id === policy.goto);
  if (index === -1) return { kind: "none" };

  const spent = loops.get(phase.id) ?? 0;

  if (spent >= policy.maxLoops) return { kind: "exhausted", rounds: policy.maxLoops };

  loops.set(phase.id, spent + 1);

  return {
    kind: "retry",
    index,
    round: spent + 1,
    of: policy.maxLoops,
    correction: { fromPhase: phase.id, artifact: phase.output, content: artifact },
  };
}

import type { Gate } from "../../model/types.js";

/**
 * Severity labels the phase prompts ask for. A gate declared `when: findings`
 * only stops when one of these appears, so a clean review does not interrupt.
 */
const SEVERITY = /\[(blocking|serious|minor|critical|high|medium|low)\]/i;

export function shouldStop(gate: Gate, artifact: string): boolean {
  if (gate.when !== "findings") return true;

  return SEVERITY.test(artifact);
}

/** Where a gate's answer is kept, so a resumed run does not ask it twice. */
export function gateRecordName(phaseId: string): string {
  return `gates-${phaseId}.md`;
}

import type { Phase } from "../../model/types.js";
import type { RunContext } from "../context.js";
import { gateRecordName, shouldStop } from "./policy.js";

export type GateOutcome = "continue" | "stopped";

/**
 * The one place a run waits for a person, and the point of the whole tool.
 *
 * A resumed run never asks twice: an answer already on disk is the answer,
 * because being asked again to approve what you approved yesterday is how
 * people learn to click yes without reading.
 */
export async function passGate(
  phase: Phase,
  artifact: string,
  context: RunContext,
): Promise<GateOutcome> {
  const gate = phase.gate;
  if (!gate || !shouldStop(gate, artifact)) return "continue";

  const { store } = context;
  const record = gateRecordName(phase.id);

  if (context.resuming && store.hasArtifact(record)) {
    if (wasApproved(store.readArtifact(record), gate.options[0] as string)) return "continue";

    /* Answered no yesterday, so the answer stands — but the run has just been
     * reopened as "running", and leaving it that way is what made a refusal
     * come back around at the next start. */
    store.finish("stopped");

    return "stopped";
  }

  store.events.append("gate_opened", { phase: phase.id, artifact: phase.output });

  const answer = await context.asker.ask({
    phase: phase.id,
    artifact: phase.output,
    text: artifact,
    options: gate.options,
  });

  const decision = answer.approved ? gate.options[0] : gate.options[1];

  store.writeArtifact(record, `# ${decision}\n\n${answer.note || "(no note)"}\n`);
  store.events.append("gate_answered", { phase: phase.id, decision, note: answer.note });

  if (answer.approved) return "continue";

  store.finish("stopped");

  return "stopped";
}

function wasApproved(record: string, approveOption: string): boolean {
  return record.startsWith(`# ${approveOption}`);
}

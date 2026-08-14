import type { Phase } from "../../model/types.js";
import type { RunContext } from "../context.js";
import { ask, gateRecordName, shouldStop } from "./prompt.js";

export type GateOutcome = "continue" | "stopped";

/**
 * The one place a run waits for a person, and the point of the whole tool.
 *
 * A resumed run never asks twice: an answer already on disk is the answer,
 * because being asked again to approve something you approved yesterday is how
 * people learn to hit yes without reading.
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
    return wasApproved(store.readArtifact(record), gate.options[0] as string)
      ? "continue"
      : "stopped";
  }

  store.events.append("gate_opened", { phase: phase.id });

  const answer = await ask(gate, artifact);
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

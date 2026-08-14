import readline from "node:readline/promises";

import type { Gate } from "../../model/types.js";
import { bold, dim, line } from "../../ui.js";

export interface GateAnswer {
  approved: boolean;
  note: string;
}

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

/**
 * Shows the artifact in full and waits. This is the point of the whole tool, so
 * it shows the real text rather than a summary, and anything other than an
 * explicit yes stops the run — an accidental Enter must never approve a plan.
 */
export async function ask(gate: Gate, artifact: string): Promise<GateAnswer> {
  const [approve, reject] = gate.options as [string, string];

  line();
  line(dim("─".repeat(72)));
  line(artifact.trim());
  line(dim("─".repeat(72)));
  line();
  line(`${bold(approve)} or ${bold(reject)}?  ${dim(`[y = ${approve}, anything else = ${reject}]`)}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();

  const nextLine = async (prompt: string): Promise<string> => {
    process.stdout.write(prompt);
    const { value, done } = await lines.next();
    return done ? "" : String(value);
  };

  try {
    const choice = await nextLine("> ");
    const note = await nextLine("note (optional): ");

    return { approved: isYes(choice), note: note.trim() };
  } finally {
    rl.close();
  }
}

function isYes(answer: string): boolean {
  const normalised = answer.trim().toLowerCase();
  return normalised === "y" || normalised === "yes";
}

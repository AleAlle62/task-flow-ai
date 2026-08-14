import readline from "node:readline/promises";

import { bold, dim, line } from "../../ui.js";
import type { GateAnswer, GateAsker, GateQuestion } from "./asker.js";

/**
 * Asks in the terminal the run was started from.
 *
 * It shows the artifact in full rather than a summary, and anything other than
 * an explicit yes rejects: an accidental Enter must never approve a plan.
 */
export class TerminalAsker implements GateAsker {
  async ask(question: GateQuestion): Promise<GateAnswer> {
    const [approve, reject] = question.options as [string, string];

    line();
    line(dim("─".repeat(72)));
    line(question.text.trim());
    line(dim("─".repeat(72)));
    line();
    line(`${bold(approve)} or ${bold(reject)}?  ${dim(`[y = ${approve}, anything else = ${reject}]`)}`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const lines = rl[Symbol.asyncIterator]();

    /** Ends the wait if input closes, instead of hanging forever on a pipe. */
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
}

function isYes(answer: string): boolean {
  const normalised = answer.trim().toLowerCase();

  return normalised === "y" || normalised === "yes";
}

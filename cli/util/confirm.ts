import readline from "node:readline/promises";

import { bold, dim, line } from "../ui.js";

/**
 * A yes-or-no question in the terminal the command was started from.
 *
 * Anything but an explicit yes is a no, and so is a nobody: with no terminal
 * attached — a pipe, a cron job, a container — the question is not asked at
 * all. A prompt with no one to read it does not wait politely, it hangs the
 * run forever, and the safe answer was no anyway.
 */
export async function confirm(question: string, hint?: string): Promise<boolean> {
  if (process.stdin.isTTY !== true) return false;

  line();
  line(bold(question));
  if (hint) line(dim(hint));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();

  try {
    process.stdout.write(dim("[y/N] "));

    const { value, done } = await lines.next();
    if (done) return false;

    const answer = String(value).trim().toLowerCase();

    return answer === "y" || answer === "yes";
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

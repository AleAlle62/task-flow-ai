import readline from "node:readline/promises";

import { bold, dim, line } from "../ui.js";

/**
 * Who asks what the task is, when it was not given on the command line.
 *
 * Same shape as the gate asker and for the same reason: the run does not care
 * whether the answer was typed in a terminal or in a browser.
 */
export interface TaskAsker {
  askTask(): Promise<string>;
}

export class TerminalTaskAsker implements TaskAsker {
  async askTask(): Promise<string> {
    line();
    line(bold("What should be done?"));
    line(dim("One or two sentences. The first phase turns it into a specification."));

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
      return (await rl.question("> ")).trim();
    } finally {
      rl.close();
    }
  }
}

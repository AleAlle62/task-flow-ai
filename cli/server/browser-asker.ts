import type { GateAnswer, GateAsker, GateQuestion } from "../run/gates/asker.js";
import { dim, line, bold } from "../ui.js";

/**
 * Parks the question until the dashboard answers it.
 *
 * Only one question is ever open at a time, because a pipeline is a queue and
 * not a form. An answer arriving for a question nobody is waiting on is
 * refused rather than applied to whatever is open now.
 */
export class BrowserAsker implements GateAsker {
  private open?: GateQuestion;
  private settle?: (answer: GateAnswer) => void;

  constructor(private readonly url: string) {}

  get question(): GateQuestion | undefined {
    return this.open;
  }

  ask(question: GateQuestion): Promise<GateAnswer> {
    this.open = question;

    line();
    line(`${bold("waiting for you")} ${dim(`· ${question.phase}`)}`);
    line(dim(`  ${this.url}`));

    return new Promise<GateAnswer>((resolve) => {
      this.settle = resolve;
    });
  }

  /** False when nothing is being asked, so a stale click cannot approve anything. */
  answer(approved: boolean, note: string): boolean {
    const resolve = this.settle;
    if (!this.open || !resolve) return false;

    this.open = undefined;
    this.settle = undefined;
    resolve({ approved, note });

    return true;
  }
}

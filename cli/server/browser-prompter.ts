import type { GateAnswer, GateAsker, GateQuestion } from "../run/gates/asker.js";
import type { TaskAsker } from "../run/task-asker.js";
import { bold, dim, line } from "../ui.js";

/**
 * Everything the dashboard is asked, and where the answers come back.
 *
 * One question is open at a time, because a run is a queue and not a form: an
 * answer arriving for a question nobody is waiting on is refused rather than
 * applied to whatever happens to be open now.
 */
export class BrowserPrompter implements GateAsker, TaskAsker {
  private gateQuestion?: GateQuestion;
  private settleGate?: (answer: GateAnswer) => void;

  private wantsTask = false;
  private settleTask?: (task: string) => void;

  constructor(private readonly url: string) {}

  get question(): GateQuestion | undefined {
    return this.gateQuestion;
  }

  get awaitingTask(): boolean {
    return this.wantsTask;
  }

  askTask(): Promise<string> {
    this.wantsTask = true;

    line();
    line(bold("Waiting for you to say what should be done"));
    line(dim(`  ${this.url}`));

    return new Promise<string>((resolve) => {
      this.settleTask = resolve;
    });
  }

  /** False when no task is being asked for, or the text is empty. */
  provideTask(task: string): boolean {
    const trimmed = task.trim();
    const resolve = this.settleTask;

    if (!this.wantsTask || !resolve || trimmed === "") return false;

    this.wantsTask = false;
    this.settleTask = undefined;
    resolve(trimmed);

    return true;
  }

  ask(question: GateQuestion): Promise<GateAnswer> {
    this.gateQuestion = question;

    line();
    line(`${bold("waiting for you")} ${dim(`· ${question.phase}`)}`);
    line(dim(`  ${this.url}`));

    return new Promise<GateAnswer>((resolve) => {
      this.settleGate = resolve;
    });
  }

  /**
   * False when nothing is being asked, so a stale click cannot approve
   * anything — and false when the answer names a different phase than the one
   * on the table.
   *
   * The phase has to be named because approval is not a generic yes. With two
   * tabs open on the same run, the second still showing the plan while the
   * first has already approved it, a click meant for the plan would otherwise
   * land on whatever question opened next — an approval for one artifact
   * spent on another, and this particular click is the one that lets an agent
   * write to your code.
   */
  answer(phase: string, approved: boolean, note: string): boolean {
    const resolve = this.settleGate;

    if (!this.gateQuestion || !resolve) return false;
    if (this.gateQuestion.phase !== phase) return false;

    this.gateQuestion = undefined;
    this.settleGate = undefined;
    resolve({ approved, note });

    return true;
  }
}

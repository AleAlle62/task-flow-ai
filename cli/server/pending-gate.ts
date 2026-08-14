import type { GateAnswer } from "../run/gates/prompt.js";

export interface PendingGate {
  phase: string;
  artifact: string;
  text: string;
  options: string[];
}

/**
 * The question a run is currently waiting on, and the place its answer arrives.
 *
 * This is the whole point of the dashboard: the pipeline stops, this holds what
 * it is stopped on, and the browser fills it in. Only one question is ever open
 * at a time, because a pipeline is a queue and not a form.
 */
export class GateBridge {
  private open?: PendingGate;
  private resolve?: (answer: GateAnswer) => void;

  get question(): PendingGate | undefined {
    return this.open;
  }

  /** Resolves when someone answers, whether from the browser or elsewhere. */
  wait(question: PendingGate): Promise<GateAnswer> {
    this.open = question;

    return new Promise<GateAnswer>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Ignored when nothing is being asked, so a stale click cannot approve anything. */
  answer(approved: boolean, note: string): boolean {
    if (!this.open || !this.resolve) return false;

    const settle = this.resolve;

    this.open = undefined;
    this.resolve = undefined;
    settle({ approved, note });

    return true;
  }
}

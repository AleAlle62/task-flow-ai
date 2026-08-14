/**
 * Who can put a question to a person, and how the answer comes back.
 *
 * The run knows only this. Whether the question appears in a terminal or in a
 * browser is decided once, when the run starts, and nothing in the pipeline is
 * written differently because of it — which is also how a third way of asking
 * could be added without touching any of it.
 */

export interface GateQuestion {
  phase: string;
  /** The artifact being shown, by name. */
  artifact: string;
  text: string;
  /** Approve first, reject second, as declared in the pipeline. */
  options: string[];
}

export interface GateAnswer {
  approved: boolean;
  note: string;
}

export interface GateAsker {
  ask(question: GateQuestion): Promise<GateAnswer>;
}

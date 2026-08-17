import type { RunStore } from "../run/store/store.js";
import type { BrowserPrompter } from "./browser-prompter.js";

/** One phase as the page needs it before there is anything to show of it. */
export interface PlannedPhase {
  id: string;
  output: string;
  canWrite: boolean;
}

/**
 * What the dashboard is currently showing.
 *
 * The run is missing at first on purpose: the page opens before anything has
 * been decided, asks what should be done, and the run appears once you answer.
 * That ordering is the whole reason this holder exists rather than the server
 * simply being handed a run.
 *
 * The plan, though, is known from the start — it comes from the pipeline file,
 * not from the run — so the page can show what is about to happen, and which
 * phase will be allowed to write, while you are still deciding whether to ask
 * for it.
 */
export class Session {
  private current?: RunStore;

  constructor(
    readonly prompter: BrowserPrompter,
    readonly plan: PlannedPhase[],
  ) {}

  get store(): RunStore | undefined {
    return this.current;
  }

  attach(store: RunStore): void {
    this.current = store;
  }
}

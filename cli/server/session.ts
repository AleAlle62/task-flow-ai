import type { RunStore } from "../run/store/store.js";
import type { BrowserPrompter } from "./browser-prompter.js";

/**
 * What the dashboard is currently showing.
 *
 * The run is missing at first on purpose: the page opens before anything has
 * been decided, asks what should be done, and the run appears once you answer.
 * That ordering is the whole reason this holder exists rather than the server
 * simply being handed a run.
 */
export class Session {
  private current?: RunStore;

  constructor(readonly prompter: BrowserPrompter) {}

  get store(): RunStore | undefined {
    return this.current;
  }

  attach(store: RunStore): void {
    this.current = store;
  }
}

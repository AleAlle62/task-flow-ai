import type { Pipeline } from "../model/types.js";
import type { Provider } from "../providers/index.js";
import type { RunStore } from "./store/store.js";

/** Everything one run needs, passed around instead of rebuilt at each step. */
export interface RunContext {
  pipeline: Pipeline;
  provider: Provider;
  store: RunStore;
  projectDir: string;
  model?: string;
  resuming: boolean;
}

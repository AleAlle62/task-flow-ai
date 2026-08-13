import path from "node:path";

import { loadPipeline } from "../pipeline/load.js";
import { resolveProvider } from "../providers/index.js";
import { runPipeline } from "../run/orchestrator.js";
import { RunStore } from "../run/store.js";
import { DEFAULT_PIPELINE } from "../paths.js";
import { parseArgs } from "../util/args.js";
import { ConfigError } from "../util/guards.js";
import { bold, dim, green, line, red } from "../ui.js";

const OPTIONS = ["pipeline", "provider", "model", "cwd"] as const;

/**
 * Puts the pieces together in the order the run needs them: read the pipeline,
 * check the provider is usable, open a run directory, then hand over to the
 * orchestrator. Everything that can be known to be wrong is found before the
 * first phase, so a run never dies four phases in for a fixable reason.
 */
export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parseArgs(argv, OPTIONS);
  const task = positional.join(" ").trim();

  if (task === "") {
    throw new ConfigError(`nothing to do. Try: task-flow-ai run "fix the empty cart bug"`);
  }

  const projectDir = path.resolve(flags["cwd"] ?? process.cwd());
  const pipeline = loadPipeline(flags["pipeline"] ?? DEFAULT_PIPELINE, projectDir);
  const provider = resolveProvider(flags["provider"]);

  await provider.preflight();

  const store = RunStore.create({
    projectDir,
    task,
    pipeline: pipeline.source,
  });

  announce(task, provider.id, store.dir);

  const status = await runPipeline({
    pipeline,
    provider,
    store,
    projectDir,
    ...(flags["model"] ? { model: flags["model"] } : {}),
  });

  if (status === "done") store.finish("done");

  summarise(status, store);

  return status === "failed" ? 1 : 0;
}

function announce(task: string, providerId: string, dir: string): void {
  line();
  line(`${bold(task)}`);
  line(dim(`${providerId} · ${dir}`));
}

function summarise(status: string, store: RunStore): void {
  const state = store.current;
  const done = state.phases.filter((phase) => phase.status === "done").length;
  const cost = state.totalCostUsd > 0 ? ` · $${state.totalCostUsd.toFixed(4)}` : "";

  const headline =
    status === "done"
      ? `${green("done")} ${done} phases${cost}`
      : status === "stopped"
        ? `stopped after ${done} phases${cost}`
        : `${red("failed")} after ${done} phases${cost}`;

  line();
  line(headline);
  line(dim(`artifacts in ${store.dir}`));
}

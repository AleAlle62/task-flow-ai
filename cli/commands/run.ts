import path from "node:path";

import { DEFAULT_PIPELINE } from "../paths.js";
import { loadPipeline } from "../pipeline/load.js";
import { resolveProvider } from "../providers/index.js";
import { TerminalAsker } from "../run/gates/terminal.js";
import { runPipeline } from "../run/orchestrator.js";
import { RunStore } from "../run/store/store.js";
import { startDashboard, type Dashboard } from "../server/http.js";
import { openInBrowser } from "../util/open.js";
import { parseArgs } from "../util/args.js";
import { ConfigError } from "../util/guards.js";
import { bold, dim, green, line, red } from "../ui.js";

const OPTIONS = ["pipeline", "provider", "model", "cwd", "resume", "port", "no-web"] as const;

const DEFAULT_PORT = 4179;

/**
 * Puts the pieces together in the order a run needs them: read the pipeline,
 * check the provider is usable, open a run directory, start the dashboard, then
 * hand over to the orchestrator. Everything knowable in advance is checked
 * before the first phase, so a run never dies four phases in for a fixable
 * reason.
 */
export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parseArgs(argv, OPTIONS);

  const projectDir = path.resolve(flags["cwd"] ?? process.cwd());
  const pipeline = loadPipeline(flags["pipeline"] ?? DEFAULT_PIPELINE, projectDir);
  const provider = resolveProvider(flags["provider"]);

  await provider.preflight();

  const resumeId = resolveResumeId(flags["resume"], projectDir);
  const store = resumeId
    ? RunStore.open(projectDir, resumeId)
    : RunStore.create({
        projectDir,
        task: requireTask(positional),
        pipeline: pipeline.source,
        phases: pipeline.phases.map(({ id, output }) => ({ id, output })),
      });

  const dashboard = flags["no-web"] ? undefined : await openDashboard(store, flags["port"]);

  announce(store, provider.id, resumeId !== undefined, dashboard);

  try {
    const status = await runPipeline({
      pipeline,
      provider,
      store,
      projectDir,
      asker: dashboard?.asker ?? new TerminalAsker(),
      resuming: resumeId !== undefined,
      ...(flags["model"] ? { model: flags["model"] } : {}),
    });

    if (status === "done") store.finish("done");

    summarise(status, store);

    return status === "failed" ? 1 : 0;
  } finally {
    await dashboard?.close();
  }
}

/**
 * A busy port is not worth ending a run over: the pipeline still works, it just
 * asks in the terminal instead.
 */
async function openDashboard(
  store: RunStore,
  port: string | undefined,
): Promise<Dashboard | undefined> {
  try {
    const dashboard = await startDashboard(store, Number(port ?? DEFAULT_PORT));

    openInBrowser(dashboard.url);

    return dashboard;
  } catch (err) {
    line();
    line(`${dim("could not start the dashboard, asking here instead:")} ${String(err)}`);

    return undefined;
  }
}

function requireTask(positional: string[]): string {
  const task = positional.join(" ").trim();

  if (task === "") {
    throw new ConfigError(`nothing to do. Try: task-flow-ai run "fix the empty cart bug"`);
  }

  return task;
}

/** `--resume last` picks the most recent run that never reached an end. */
function resolveResumeId(requested: string | undefined, projectDir: string): string | undefined {
  if (requested === undefined) return undefined;
  if (requested !== "last") return requested;

  const id = RunStore.lastUnfinished(projectDir);

  if (!id) throw new ConfigError(`no unfinished run to resume in ${projectDir}`);

  return id;
}

function announce(
  store: RunStore,
  providerId: string,
  resuming: boolean,
  dashboard: Dashboard | undefined,
): void {
  line();
  line(bold(store.current.task));
  line(dim(`${resuming ? "resuming · " : ""}${providerId} · ${store.dir}`));

  if (dashboard) line(dim(`watching at ${dashboard.url}`));
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

  if (status === "failed") {
    line(dim(`resume with: task-flow-ai run --resume ${state.id}`));
  }
}


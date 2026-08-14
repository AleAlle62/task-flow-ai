import path from "node:path";

import { DEFAULT_PIPELINE } from "../paths.js";
import { loadPipeline } from "../pipeline/load.js";
import { resolveProvider } from "../providers/index.js";
import { TerminalAsker } from "../run/gates/terminal.js";
import { runPipeline } from "../run/orchestrator.js";
import { RunStore } from "../run/store/store.js";
import { TerminalTaskAsker } from "../run/task-asker.js";
import { startDashboard, type Dashboard } from "../server/http.js";
import { parseArgs } from "../util/args.js";
import { ConfigError } from "../util/guards.js";
import { openInBrowser } from "../util/open.js";
import { bold, dim, green, line, red } from "../ui.js";

const OPTIONS = ["pipeline", "provider", "model", "cwd", "resume", "port", "no-web"] as const;

const DEFAULT_PORT = 4179;

/**
 * Puts the pieces together in the order a run needs them: check what can be
 * checked, open the dashboard, find out what the task is, then hand over to the
 * orchestrator.
 *
 * The task can come from the command line, from the page, or from the terminal.
 * The page is the default because that is where you will be watching anyway,
 * and typing a paragraph into a shell argument is a poor way to describe a bug.
 */
export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parseArgs(argv, OPTIONS);

  const projectDir = path.resolve(flags["cwd"] ?? process.cwd());
  const pipeline = loadPipeline(flags["pipeline"] ?? DEFAULT_PIPELINE, projectDir);
  const provider = resolveProvider(flags["provider"]);

  await provider.preflight();

  const dashboard = flags["no-web"] ? undefined : await openDashboard(flags["port"]);

  try {
    const resumeId = resolveResumeId(flags["resume"], projectDir);

    const store = resumeId
      ? RunStore.open(projectDir, resumeId)
      : RunStore.create({
          projectDir,
          task: await resolveTask(positional, dashboard),
          pipeline: pipeline.source,
          phases: pipeline.phases.map(({ id, output }) => ({ id, output })),
        });

    dashboard?.session.attach(store);
    announce(store, provider.id, resumeId !== undefined);

    const status = await runPipeline({
      pipeline,
      provider,
      store,
      projectDir,
      asker: dashboard?.prompter ?? new TerminalAsker(),
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

/** From the command line if it was given there, otherwise from wherever you are. */
async function resolveTask(
  positional: string[],
  dashboard: Dashboard | undefined,
): Promise<string> {
  const typed = positional.join(" ").trim();
  if (typed !== "") return typed;

  const task = await (dashboard?.prompter ?? new TerminalTaskAsker()).askTask();

  if (task.trim() === "") throw new ConfigError("no task given, so there is nothing to run");

  return task.trim();
}

/**
 * A busy port is not worth ending a run over: the pipeline still works, it just
 * asks in the terminal instead.
 */
async function openDashboard(port: string | undefined): Promise<Dashboard | undefined> {
  try {
    const dashboard = await startDashboard(Number(port ?? DEFAULT_PORT));

    line();
    line(dim(`dashboard at ${dashboard.url}`));
    openInBrowser(dashboard.url);

    return dashboard;
  } catch (err) {
    line();
    line(`${dim("could not start the dashboard, asking here instead:")} ${String(err)}`);

    return undefined;
  }
}

/** `--resume last` picks the most recent run that never reached an end. */
function resolveResumeId(requested: string | undefined, projectDir: string): string | undefined {
  if (requested === undefined) return undefined;
  if (requested !== "last") return requested;

  const id = RunStore.lastUnfinished(projectDir);

  if (!id) throw new ConfigError(`no unfinished run to resume in ${projectDir}`);

  return id;
}

function announce(store: RunStore, providerId: string, resuming: boolean): void {
  line();
  line(bold(store.current.task));
  line(dim(`${resuming ? "resuming · " : ""}${providerId} · ${store.dir}`));
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

import path from "node:path";

import { DEFAULT_PIPELINE, projectCustomisations, projectPipeline } from "../paths.js";
import { describeFlow } from "../pipeline/describe.js";
import { loadPipeline } from "../pipeline/load.js";
import { resolveProvider } from "../providers/index.js";
import { TerminalAsker } from "../run/gates/terminal.js";
import { runPipeline } from "../run/orchestrator.js";
import { RunStore } from "../run/store/store.js";
import { TerminalTaskAsker } from "../run/task-asker.js";
import { startDashboard, type Dashboard } from "../server/http.js";
import type { PlannedPhase } from "../server/session.js";
import { parseArgs } from "../util/args.js";
import { confirm } from "../util/confirm.js";
import { ConfigError } from "../util/guards.js";
import { openInBrowser } from "../util/open.js";
import { bold, dim, green, line, red } from "../ui.js";

/**
 * One option, and only because a cheaper model is a real reason to run this
 * differently. Everything else that used to be a flag is now something the
 * command works out for itself — which run to continue, which port is free,
 * where to ask you. An option you have to know about is an option most people
 * never find.
 */
const OPTIONS = ["model"] as const;

const PREFERRED_PORT = 4179;

/**
 * Puts the pieces together in the order a run needs them: check what can be
 * checked, show what is about to happen, offer to continue an unfinished run,
 * open the dashboard, find out what the task is, then hand over.
 *
 * The task usually comes from the page, because that is where you will be
 * watching anyway and typing a paragraph into a shell argument is a poor way to
 * describe a bug. Given on the command line, it is used as it stands.
 */
export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parseArgs(argv, OPTIONS);

  const projectDir = process.cwd();
  const own = await useProjectFlow(projectDir);

  const pipeline = loadPipeline(
    own ? (projectPipeline(projectDir) ?? DEFAULT_PIPELINE) : DEFAULT_PIPELINE,
    projectDir,
    own,
  );

  const provider = resolveProvider();

  await provider.preflight();

  line();
  line(dim(describeFlow(pipeline).join("\n")));

  const resumeId = await offerToResume(projectDir);
  const dashboard = await openDashboard(
    pipeline.phases.map(({ id, output, canWrite }) => ({ id, output, canWrite })),
  );

  try {
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

/**
 * Whether to run this project's own phases, if it brought any.
 *
 * A `.taskflow/` directory decides which phases exist and what each one is
 * told to do, and it arrives with the project: cloning a repository is enough
 * to put one on your disk. Using it because it is there would mean a
 * repository could rewrite the pipeline that is about to read it — so it is
 * shown, named file by file, and it is off unless you say yes.
 */
async function useProjectFlow(projectDir: string): Promise<boolean> {
  const files = projectCustomisations(projectDir);
  if (files.length === 0) return false;

  line();
  line(bold("This project brings its own pipeline files:"));
  for (const file of files) line(dim(`  ${path.relative(projectDir, file)}`));

  const yes = await confirm(
    "Run the project's version instead of the packaged one?",
    "These files decide which phases run and what each one is told to do. Answering no runs the packaged pipeline.",
  );

  if (!yes) line(dim("Using the packaged pipeline."));

  return yes;
}

/**
 * An unfinished run in this project is offered rather than waited for.
 *
 * Continuing is almost always what you want — the phases that finished are paid
 * for already — but it is never assumed: the old run may be the very thing you
 * gave up on.
 */
async function offerToResume(projectDir: string): Promise<string | undefined> {
  const id = RunStore.lastUnfinished(projectDir);
  if (!id) return undefined;

  const wanted = await confirm(
    `There is an unfinished run here (${id}). Continue it?`,
    "Continuing skips the phases that already finished. Answering no starts a new run.",
  );

  return wanted ? id : undefined;
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
 * The usual port first, so the address is familiar; any free one if it is
 * taken, so a second run in another project is not an error. If neither works
 * the run still happens — it just asks in the terminal.
 */
async function openDashboard(plan: PlannedPhase[]): Promise<Dashboard | undefined> {
  for (const port of [PREFERRED_PORT, 0]) {
    try {
      const dashboard = await startDashboard(port, plan);

      /* One ticket for the browser and a second one printed, because a ticket
       * works once: if the browser does not open, the address on screen still
       * lets you in. */
      openInBrowser(dashboard.url());

      line();
      line(dim(`dashboard at ${dashboard.url()}`));

      return dashboard;
    } catch {
      continue;
    }
  }

  line();
  line(dim("could not start the dashboard, asking here instead"));

  return undefined;
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
    line(dim("run it again here to pick up where it stopped"));
  }
}

import type { RunStatus } from "../model/run.js";
import type { Phase, Pipeline } from "../model/types.js";
import type { Provider } from "../providers/index.js";
import { errorMessage } from "../util/guards.js";
import { amber, dim, line, phaseFailed, phaseFinished, phaseStarted } from "../ui.js";
import { ask, shouldStop } from "./gate.js";
import { buildPhaseInput } from "./inputs.js";
import type { RunStore } from "./store.js";

export interface RunOptions {
  pipeline: Pipeline;
  provider: Provider;
  store: RunStore;
  projectDir: string;
  model?: string;
}

/**
 * Runs the phases in order. Each one starts as a separate process with a clean
 * context and receives only the artifacts it declared, which is the entire
 * reason this is a pipeline rather than a long conversation.
 *
 * The correction loop and resuming an interrupted run are not here yet: a phase
 * that fails ends the run, and a review with blocking findings is reported
 * rather than sent back.
 */
export async function runPipeline(options: RunOptions): Promise<RunStatus> {
  const { pipeline, provider, store } = options;
  const runnable = selectRunnablePhases(pipeline, provider);

  for (const [index, phase] of runnable.entries()) {
    phaseStarted(index, runnable.length, phase.id);

    const outcome = await runPhase(phase, options);
    if (outcome !== "continue") return outcome;
  }

  return "done";
}

/**
 * A provider that cannot restrict tools cannot be trusted with the writing
 * phase, so the run happens without it. Everything read-only still produces
 * something worth having.
 */
function selectRunnablePhases(pipeline: Pipeline, provider: Provider): Phase[] {
  if (provider.enforcesTools) return pipeline.phases;

  const skipped = pipeline.phases.filter((phase) => phase.canWrite);
  if (skipped.length === 0) return pipeline.phases;

  line();
  line(
    `${amber("!")} provider "${provider.id}" cannot enforce which tools a phase gets, ` +
      `so ${skipped.map((p) => p.id).join(", ")} will not run and nothing will be written.`,
  );
  line(dim(`  You still get the specification, the exploration, the plan and the review.`));

  return pipeline.phases.filter((phase) => !phase.canWrite);
}

type Outcome = "continue" | RunStatus;

async function runPhase(phase: Phase, options: RunOptions): Promise<Outcome> {
  const { pipeline, provider, store, projectDir, model } = options;

  store.startPhase(phase.id, phase.output);

  let text: string;
  let costUsd: number | undefined;

  try {
    const result = await provider.run({
      instructions: phase.agent.prompt,
      input: buildPhaseInput(phase, store, projectDir),
      tools: phase.agent.tools,
      canWrite: phase.canWrite,
      cwd: projectDir,
      timeoutMs: (phase.timeout ?? pipeline.defaults.timeout) * 1000,
      ...(model ? { model } : {}),
    });

    text = result.text;
    costUsd = result.costUsd;
  } catch (err) {
    const reason = errorMessage(err);
    store.failPhase(phase.id, reason);
    phaseFailed(reason);
    store.finish("failed");
    return "failed";
  }

  store.writeArtifact(phase.output, text);
  store.finishPhase(phase.id, ...(costUsd === undefined ? [] : [{ costUsd }]));

  const record = store.current.phases.find((p) => p.id === phase.id);
  phaseFinished(phase.output, (record?.durationMs ?? 0) / 1000, costUsd);

  return phase.gate ? await runGate(phase, text, store) : "continue";
}

async function runGate(phase: Phase, artifact: string, store: RunStore): Promise<Outcome> {
  const gate = phase.gate;
  if (!gate || !shouldStop(gate, artifact)) return "continue";

  store.events.append("gate_opened", { phase: phase.id });

  const answer = await ask(gate, artifact);
  const decision = answer.approved ? gate.options[0] : gate.options[1];

  store.writeArtifact(
    `gates-${phase.id}.md`,
    `# ${decision}\n\n${answer.note || "(no note)"}\n`,
  );
  store.events.append("gate_answered", {
    phase: phase.id,
    decision,
    note: answer.note,
  });

  if (answer.approved) return "continue";

  line();
  line(`${amber("■")} stopped at ${phase.id}. Nothing was written.`);
  store.finish("stopped");

  return "stopped";
}

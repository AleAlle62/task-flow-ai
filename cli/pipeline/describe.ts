import type { Phase, Pipeline } from "../model/types.js";

/**
 * A pipeline written out as the flow it describes: every phase, what it reads,
 * what it may do, where it stops for you.
 *
 * Printed at the start of every run rather than hidden behind a command of its
 * own. What a run is about to be allowed to do is worth reading before it
 * happens, and a check you have to know to ask for is a check nobody runs.
 */
export function describeFlow(pipeline: Pipeline): string[] {
  const writers = pipeline.phases.filter((phase) => phase.canWrite).length;

  return [
    `${pipeline.source}  ·  ${pipeline.defaults.timeout}s per phase  ·  writable: ${pipeline.writePaths.join(", ")}`,
    "",
    ...pipeline.phases.flatMap(describePhase),
    "",
    `${pipeline.phases.length} phases, ${writers} of which can touch your code.`,
  ];
}

function describePhase(phase: Phase): string[] {
  const marker = phase.canWrite ? "WRITES" : "reads ";
  const inputs = phase.inputs.length > 0 ? phase.inputs.join(", ") : "nothing";

  const lines = [
    `  ${marker}  ${phase.id}`,
    `          ${inputs}  ->  ${phase.output}`,
    `          can: ${phase.agent.capabilities.join(", ")}`,
  ];

  if (phase.gate) {
    lines.push(`          stops for you: ${phase.gate.options.join(" / ")}`);
  }

  if (phase.findingsPolicy) {
    const { goto, maxLoops } = phase.findingsPolicy;
    lines.push(`          findings go back to ${goto}, max ${maxLoops}`);
  }

  return lines;
}

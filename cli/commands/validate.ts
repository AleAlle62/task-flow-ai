import type { Phase, Pipeline } from "../model/types.js";
import { loadPipeline } from "../pipeline/load.js";

/**
 * Reads a pipeline and prints it back as the flow it describes. Its real job is
 * to fail: a pipeline that is wrong should say so here, before a run starts
 * spending anything.
 */
export function validate(file: string, projectDir: string): number {
  print(loadPipeline(file, projectDir));

  return 0;
}

function print(pipeline: Pipeline): void {
  const writers = pipeline.phases.filter((phase) => phase.canWrite).length;

  const lines = [
    pipeline.source,
    "",
    `timeout   ${pipeline.defaults.timeout}s per phase`,
    `writable  ${pipeline.writePaths.join(", ")}`,
    "",
    ...pipeline.phases.flatMap(describe),
    "",
    `${pipeline.phases.length} phases, ${writers} of which can touch your code.`,
    "",
  ];

  process.stdout.write(lines.join("\n"));
}

function describe(phase: Phase): string[] {
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

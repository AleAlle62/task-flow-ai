import type { Phase, Pipeline } from "../model/types.js";
import { loadPipeline } from "../pipeline/load.js";
import { toolNames } from "../providers/claude-cli.js";

/**
 * Reads a pipeline and prints it back as the flow it describes. Its real job is
 * to fail: a pipeline that is wrong should say so here, before a run starts
 * spending anything.
 */
export function validate(file: string, projectDir: string): number {
  const pipeline = loadPipeline(file, projectDir);

  print(pipeline);
  warnAboutDrift(pipeline);

  return 0;
}

/**
 * The phase files carry a second, redundant list: `tools:`, which Claude Code
 * reads when it loads the same file as one of its own subagents. The pipeline
 * ignores it, so it can quietly say something different from `capabilities:` —
 * and someone editing it would believe they had changed what a phase may do.
 *
 * Only a wider list is a problem. A `tools:` line that grants less than the
 * capabilities is not drift but a deliberately narrower reading, and the phase
 * files use it: the CLI can pin `inspect` to read-only commands, and a plain
 * subagent loader cannot, so there it simply gets no command tool at all.
 *
 * Only a warning, and only here: `validate` is where you go to be told what the
 * pipeline will do, and this is the one place the two lists can be compared.
 * That it needs the Claude adapter to do the comparing is the point — the second
 * list exists for that one reader.
 */
function warnAboutDrift(pipeline: Pipeline): void {
  const wider = pipeline.phases
    .map((phase) => ({ phase, extra: grantedBeyond(phase) }))
    .filter(({ extra }) => extra.length > 0);

  if (wider.length === 0) return;

  process.stdout.write(
    `\nwarning: the "tools" line grants more than "capabilities" allows:\n` +
      wider
        .map(
          ({ phase, extra }) =>
            `  ${phase.agent.file}\n` +
            `    tools:        ${phase.agent.declaredTools.join(", ")}\n` +
            `    capabilities: ${phase.agent.capabilities.join(", ")}\n` +
            `    not covered:  ${extra.join(", ")}`,
        )
        .join("\n") +
      `\n  This run obeys "capabilities". The "tools" line only matters when Claude Code\n` +
      `  loads the file as one of its own subagents — which is the plugin, not the CLI,\n` +
      `  and there the extra tools would really be granted.\n`,
  );
}

/** Tool names the `tools:` line hands out that the capabilities would not. */
function grantedBeyond(phase: Phase): string[] {
  const allowed = new Set(toolNames(phase.agent.capabilities));

  return phase.agent.declaredTools.filter((tool) => !allowed.has(tool));
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

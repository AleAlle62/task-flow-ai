import { COMPUTED_INPUTS, GATE_INPUT_PREFIX, type Phase } from "../model/types.js";
import { ConfigError } from "../util/guards.js";

/**
 * Whether a pipeline makes sense as a whole. One function per rule, each
 * answering a question a person would ask reading the file out loud. Nothing
 * here opens a file: the phases arrive ready.
 */
export function checkAll(phases: Phase[], file: string): void {
  checkIdsAreUnique(phases, file);
  checkInputsArePreviouslyProduced(phases, file);
  checkFindingsTargetsExist(phases, file);
  checkExactlyOnePhaseWrites(phases, file);
}

/** "Do two phases share a name?" */
function checkIdsAreUnique(phases: Phase[], file: string): void {
  const seen = new Set<string>();

  for (const phase of phases) {
    if (seen.has(phase.id)) {
      throw new ConfigError(`${file}: duplicate phase id "${phase.id}"`);
    }
    seen.add(phase.id);
  }
}

/** "Is every phase handed something that actually exists by the time it runs?" */
function checkInputsArePreviouslyProduced(phases: Phase[], file: string): void {
  const produced = new Set<string>();

  for (const phase of phases) {
    for (const input of phase.inputs) {
      if (isComputed(input)) continue;

      if (!produced.has(input)) {
        throw new ConfigError(
          `${file}: phase "${phase.id}" reads "${input}", which no earlier phase produces. Check the "output" of the phases above it.`,
        );
      }
    }
    produced.add(phase.output);
  }
}

/** "When work is sent back, is it sent back to a phase that exists?" */
function checkFindingsTargetsExist(phases: Phase[], file: string): void {
  const ids = new Set(phases.map((phase) => phase.id));

  for (const phase of phases) {
    const target = phase.findingsPolicy?.goto;

    if (target && !ids.has(target)) {
      throw new ConfigError(
        `${file}: phase "${phase.id}" sends work back to "${target}", which is not a phase`,
      );
    }
  }
}

/**
 * "Who can touch my code?" — the question this whole tool exists to answer.
 *
 * Checked against the agent files rather than the pipeline, so it cannot be
 * loosened by editing the YAML alone.
 */
function checkExactlyOnePhaseWrites(phases: Phase[], file: string): void {
  const writers = phases.filter((phase) => phase.canWrite);

  if (writers.length === 0) {
    throw new ConfigError(
      `${file}: no phase can write, so a run could never change anything.\nGive one phase a writing tool in its agents/<id>.md frontmatter.`,
    );
  }

  if (writers.length > 1) {
    const named = writers.map((phase) => `${phase.id} (${phase.agent.file})`).join("\n  ");

    throw new ConfigError(
      `${file}: ${writers.length} phases can write to your code:\n  ${named}\n` +
        `Exactly one may — that is the security boundary of this tool. Remove Write/Edit from the "tools" line of the others.`,
    );
  }
}

function isComputed(input: string): boolean {
  return (
    (COMPUTED_INPUTS as readonly string[]).includes(input) ||
    input.startsWith(GATE_INPUT_PREFIX)
  );
}

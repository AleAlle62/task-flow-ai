import { GATE_INPUT_PREFIX, type Phase } from "../../model/types.js";
import { ConfigError } from "../../util/guards.js";
import { gateRecordName } from "../gates/policy.js";
import { currentDiff } from "./git-diff.js";
import type { RunStore } from "../store/store.js";

/** One labelled piece of what a phase is given to read. */
export interface InputBlock {
  name: string;
  content: string;
}

/**
 * Turns one declared input into its actual content.
 *
 * Three names are worked out rather than read from an artifact: `task` is what
 * the person typed, `diff` is the current state of the project, and
 * `gates.<phase>.note` is what a person wrote when they approved or rejected.
 * Everything else must have been written by a phase that already ran.
 */
export function resolveInput(
  name: string,
  phase: Phase,
  store: RunStore,
  projectDir: string,
): InputBlock | undefined {
  if (name === "task") return { name, content: store.current.task };

  if (name === "diff") return { name, content: currentDiff(projectDir) };

  if (name.startsWith(GATE_INPUT_PREFIX)) return gateNote(name, store);

  if (!store.hasArtifact(name)) {
    throw new ConfigError(
      `phase "${phase.id}" needs "${name}", which no earlier phase produced in this run.`,
    );
  }

  return { name, content: store.readArtifact(name) };
}

/** Absent until someone has actually answered that gate. */
function gateNote(input: string, store: RunStore): InputBlock | undefined {
  const phaseId = input.slice(GATE_INPUT_PREFIX.length).replace(/\.note$/, "");
  const record = gateRecordName(phaseId);

  if (!store.hasArtifact(record)) return undefined;

  return { name: input, content: store.readArtifact(record) };
}

import type { FindingsPolicy, Gate } from "../model/types.js";
import { ConfigError, asNumber, asStringArray, isRecord } from "../util/guards.js";
import { readFindingsPolicy, readGate } from "./schema-gate.js";

/**
 * Shape only: turns raw YAML into typed pieces and complains when a field is
 * the wrong kind of thing. It knows types, not meaning — whether the pipeline
 * makes sense as a whole is `rules.ts`.
 */

/** A phase as written in the file, before its agent has been loaded. */
export interface PhaseSpec {
  id: string;
  inputs: string[];
  output: string;
  timeout?: number;
  gate?: Gate;
  findingsPolicy?: FindingsPolicy;
}

export interface PipelineSpec {
  timeout: number;
  writePaths: string[];
  phases: PhaseSpec[];
}

const PHASE_ID = /^[a-z0-9][a-z0-9_-]*$/;

const DEFAULT_TIMEOUT_SECONDS = 600;

export function readPipelineSpec(raw: unknown, file: string): PipelineSpec {
  if (!isRecord(raw)) {
    throw new ConfigError(`${file}: expected a YAML mapping at the top level`);
  }

  const defaults = isRecord(raw["defaults"]) ? raw["defaults"] : {};
  const phases = raw["phases"];

  if (!Array.isArray(phases) || phases.length === 0) {
    throw new ConfigError(`${file}: "phases" must be a non-empty list`);
  }

  return {
    timeout: asNumber(defaults["timeout"], DEFAULT_TIMEOUT_SECONDS),
    writePaths: asStringArray(raw["write_paths"]) ?? ["**"],
    phases: phases.map((entry, index) => readPhase(entry, index, file)),
  };
}

function readPhase(raw: unknown, index: number, file: string): PhaseSpec {
  const position = `${file}: phase #${index + 1}`;

  if (!isRecord(raw)) throw new ConfigError(`${position}: expected a mapping`);

  const id = readId(raw["id"], position);

  const phase: PhaseSpec = {
    id,
    inputs: asStringArray(raw["inputs"]) ?? [],
    output: readOutput(raw["output"], id, file),
  };

  if (typeof raw["timeout"] === "number") phase.timeout = raw["timeout"];

  const gate = readGate(raw["gate"], id, file);
  if (gate) phase.gate = gate;

  const findingsPolicy = readFindingsPolicy(raw["on_findings"], id, file);
  if (findingsPolicy) phase.findingsPolicy = findingsPolicy;

  return phase;
}

function readId(raw: unknown, position: string): string {
  if (typeof raw !== "string" || !PHASE_ID.test(raw)) {
    throw new ConfigError(
      `${position}: "id" is required — lowercase letters, digits, "-" or "_". It is also the name of the file in agents/.`,
    );
  }

  return raw;
}

/**
 * An output is a plain file name: artifacts live in the run directory and
 * nowhere else, so a path here would be a way out of it.
 */
function readOutput(raw: unknown, id: string, file: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ConfigError(`${file}: phase "${id}": "output" is required`);
  }

  if (raw.includes("/") || raw.includes("..")) {
    throw new ConfigError(
      `${file}: phase "${id}": "output" must be a plain file name inside the run directory`,
    );
  }

  return raw;
}

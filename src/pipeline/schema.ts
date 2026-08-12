import type { FindingsPolicy, Gate } from "../model/types.js";
import { ConfigError, asNumber, asStringArray, isRecord } from "../util/guards.js";

/**
 * Shape only: turns the raw YAML into typed pieces, and complains when a field
 * is the wrong kind of thing. It knows nothing about whether the pipeline makes
 * sense as a whole — that is `rules.ts`.
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
    timeout: asNumber(defaults["timeout"], 600),
    writePaths: asStringArray(raw["write_paths"]) ?? ["**"],
    phases: phases.map((entry, index) => readPhase(entry, index, file)),
  };
}

function readPhase(raw: unknown, index: number, file: string): PhaseSpec {
  const position = `${file}: phase #${index + 1}`;
  if (!isRecord(raw)) throw new ConfigError(`${position}: expected a mapping`);

  const id = raw["id"];
  if (typeof id !== "string" || !PHASE_ID.test(id)) {
    throw new ConfigError(
      `${position}: "id" is required — lowercase letters, digits, "-" or "_". It is also the name of the file in agents/.`,
    );
  }

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

function readGate(raw: unknown, id: string, file: string): Gate | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    throw new ConfigError(`${file}: phase "${id}": "gate" must be a mapping`);
  }

  const options = asStringArray(raw["options"]);
  if (!options || options.length < 2) {
    throw new ConfigError(
      `${file}: phase "${id}": a gate needs at least two "options" to choose between`,
    );
  }

  const gate: Gate = { options };
  if (typeof raw["show"] === "string") gate.show = raw["show"];

  const when = raw["when"];
  if (when !== undefined) {
    if (when !== "always" && when !== "findings") {
      throw new ConfigError(
        `${file}: phase "${id}": gate "when" must be "always" or "findings", got ${JSON.stringify(when)}`,
      );
    }
    gate.when = when;
  }

  return gate;
}

function readFindingsPolicy(
  raw: unknown,
  id: string,
  file: string,
): FindingsPolicy | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    throw new ConfigError(`${file}: phase "${id}": "on_findings" must be a mapping`);
  }

  const goto = raw["goto"];
  if (typeof goto !== "string") {
    throw new ConfigError(`${file}: phase "${id}": "on_findings.goto" is required`);
  }

  return {
    severity: asStringArray(raw["severity"]) ?? ["blocking"],
    goto,
    maxLoops: asNumber(raw["max_loops"], 2),
  };
}

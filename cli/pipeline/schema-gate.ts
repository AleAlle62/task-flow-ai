import type { FindingsPolicy, Gate } from "../model/types.js";
import { ConfigError, asNumber, asStringArray, isRecord } from "../util/guards.js";

/** Reading the two optional pieces of a phase: where it stops, and when it loops. */

const DEFAULT_MAX_LOOPS = 2;

export function readGate(raw: unknown, id: string, file: string): Gate | undefined {
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

  const when = readWhen(raw["when"], id, file);
  if (when) gate.when = when;

  return gate;
}

export function readFindingsPolicy(
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
    maxLoops: asNumber(raw["max_loops"], DEFAULT_MAX_LOOPS),
  };
}

function readWhen(raw: unknown, id: string, file: string): Gate["when"] | undefined {
  if (raw === undefined) return undefined;

  if (raw !== "always" && raw !== "findings") {
    throw new ConfigError(
      `${file}: phase "${id}": gate "when" must be "always" or "findings", got ${JSON.stringify(raw)}`,
    );
  }

  return raw;
}

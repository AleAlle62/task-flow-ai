import fs from "node:fs";
import { parse as parseYaml } from "yaml";

import type { Phase, Pipeline } from "../model/types.js";
import { ConfigError, errorMessage } from "../util/guards.js";
import { canWrite, loadAgent } from "./agent-file.js";
import { checkAll } from "./rules.js";
import { readPipelineSpec, type PhaseSpec } from "./schema.js";

/**
 * The only way into a pipeline, in four steps and no other order:
 *
 *   1. read the file      →  raw YAML
 *   2. shape it           →  schema.ts, which knows types but not meaning
 *   3. attach the agents  →  each phase's real tools come from agents/<id>.md
 *   4. check the rules    →  rules.ts, which knows meaning but reads nothing
 *
 * Step 3 sits between the other two on purpose: the rules need the agent files
 * to decide who may write, and that answer must never come from the YAML.
 */
export function loadPipeline(file: string, projectDir: string): Pipeline {
  const spec = readPipelineSpec(readYamlFile(file), file);
  const phases = spec.phases.map((phaseSpec) => attachAgent(phaseSpec, projectDir));

  checkAll(phases, file);

  return {
    defaults: { timeout: spec.timeout },
    writePaths: spec.writePaths,
    phases,
    source: file,
  };
}

function readYamlFile(file: string): unknown {
  try {
    return parseYaml(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new ConfigError(`could not read pipeline ${file}: ${errorMessage(err)}`);
  }
}

function attachAgent(spec: PhaseSpec, projectDir: string): Phase {
  const agent = loadAgent(projectDir, spec.id);
  return { ...spec, agent, canWrite: canWrite(agent) };
}

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { PACKAGED_AGENTS_DIR, projectAgentsDir } from "../paths.js";
import {
  CAPABILITIES,
  CAPABILITY_HELP,
  changesCode,
  isCapability,
  type Capability,
} from "../model/capabilities.js";
import type { Agent } from "../model/types.js";
import { ConfigError, errorMessage, isRecord } from "../util/guards.js";
import { splitFrontmatter } from "../util/frontmatter.js";

/**
 * Reads a phase file: frontmatter on top, instructions below. The format is
 * plain markdown on purpose, so the same file can be read by this tool and by
 * any agent that loads markdown definitions — the body becomes the system
 * prompt, the frontmatter declares the capabilities.
 */
export function loadAgent(projectDir: string, id: string): Agent {
  const file = resolveAgentFile(projectDir, id);
  const parts = splitFrontmatter(fs.readFileSync(file, "utf8"));

  if (!parts) {
    throw new ConfigError(
      `${file}: missing frontmatter. A phase file opens with a "---" block declaring at least "tools".`,
    );
  }

  const header = parseHeader(parts.header, file);
  const prompt = parts.body.trim();

  if (prompt === "") {
    throw new ConfigError(`${file}: no instructions below the frontmatter`);
  }

  return {
    id,
    description: typeof header["description"] === "string" ? header["description"] : "",
    capabilities: parseCapabilities(header["capabilities"], file),
    declaredTools: parseList(header["tools"]) ?? [],
    prompt,
    file,
  };
}

export function canWrite(agent: Agent): boolean {
  return changesCode(agent.capabilities);
}

/** A project's own copy of a phase wins over the packaged one. */
function resolveAgentFile(projectDir: string, id: string): string {
  const override = path.join(projectAgentsDir(projectDir), `${id}.md`);
  if (fs.existsSync(override)) return override;

  const packaged = path.join(PACKAGED_AGENTS_DIR, `${id}.md`);
  if (fs.existsSync(packaged)) return packaged;

  throw new ConfigError(
    `no phase file for "${id}".\nExpected ${packaged}, or your own copy at ${override}.`,
  );
}

function parseHeader(header: string, file: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = parseYaml(header);
  } catch (err) {
    throw new ConfigError(`${file}: frontmatter is not valid YAML: ${errorMessage(err)}`);
  }

  if (!isRecord(parsed)) {
    throw new ConfigError(`${file}: frontmatter must be a mapping`);
  }

  return parsed;
}

/**
 * The capabilities line, checked word by word.
 *
 * A misspelling is refused rather than ignored: a phase that asked for "wrtie"
 * and silently got nothing would look read-only in every report while being
 * exactly as dangerous as before — a security boundary that fails quietly is
 * not one.
 */
function parseCapabilities(raw: unknown, file: string): Capability[] {
  const items = parseList(raw);

  if (!items) {
    throw new ConfigError(
      `${file}: "capabilities" is required in the frontmatter. It is what stops a phase\n` +
        `from writing to your code, so there is no default. Choose from:\n` +
        CAPABILITIES.map((name) => `  ${name.padEnd(8)} ${CAPABILITY_HELP[name]}`).join("\n"),
    );
  }

  const unknown = items.filter((item) => !isCapability(item));

  if (unknown.length > 0) {
    throw new ConfigError(
      `${file}: unknown ${unknown.length === 1 ? "capability" : "capabilities"} ${unknown
        .map((item) => `"${item}"`)
        .join(", ")}. Known: ${CAPABILITIES.join(", ")}.\n` +
        `These are not tool names — a provider translates them into its own.`,
    );
  }

  if (items.length === 0) {
    throw new ConfigError(`${file}: "capabilities" is empty, so the phase could do nothing`);
  }

  return items as Capability[];
}

/** Accepts both spellings found in the wild: a comma-separated string or a list. */
function parseList(raw: unknown): string[] | undefined {
  const items =
    typeof raw === "string" ? raw.split(",") : Array.isArray(raw) ? raw.map(String) : undefined;

  return items?.map((item) => item.trim()).filter((item) => item !== "");
}

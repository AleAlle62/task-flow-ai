import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { PACKAGED_AGENTS_DIR, projectAgentsDir } from "../paths.js";
import type { Agent } from "../model/types.js";
import { ConfigError, errorMessage, isRecord } from "../util/guards.js";
import { splitFrontmatter } from "../util/frontmatter.js";

/** Tools that can change the user's files. Everything else is read-only. */
const WRITING_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);

/**
 * A phase file is the same markdown Claude Code loads as an agent: frontmatter
 * on top, instructions below. One file, two readers — the CLI takes the body as
 * the system prompt and the frontmatter as the tool list.
 */
export function loadAgent(projectDir: string, id: string): Agent {
  const file = resolveAgentFile(projectDir, id);
  const raw = fs.readFileSync(file, "utf8");

  const parts = splitFrontmatter(raw);
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
    tools: parseTools(header["tools"], file),
    prompt,
    file,
  };
}

export function canWrite(agent: Agent): boolean {
  return agent.tools.some((tool) => WRITING_TOOLS.has(tool));
}

/** The project's own copy wins over the packaged one. */
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

/** Claude Code writes tools as a comma-separated string; a YAML list also works. */
function parseTools(raw: unknown, file: string): string[] {
  const items =
    typeof raw === "string" ? raw.split(",") : Array.isArray(raw) ? raw.map(String) : undefined;

  if (!items) {
    throw new ConfigError(
      `${file}: "tools" is required in the frontmatter. It is what stops a phase from writing to your code, so there is no default.`,
    );
  }

  return items.map((tool) => tool.trim()).filter((tool) => tool !== "");
}

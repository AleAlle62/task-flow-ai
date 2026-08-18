import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isRecord } from "./util/guards.js";

/**
 * Where the packaged files live, whether we run from `dist/` after a build or
 * straight from `src/` under tsx. Both sit one level below the package root.
 */
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Written down once, in package.json, and read from there.
 *
 * Kept as a second copy in the source it did what second copies do: the CLI
 * announced 0.1.0 for two releases after the package had moved on, and the
 * number a person quotes in a bug report was the wrong one.
 */
export function packageVersion(): string {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    );

    return isRecord(parsed) && typeof parsed["version"] === "string" ? parsed["version"] : "unknown";
  } catch {
    return "unknown";
  }
}

export const DEFAULT_PIPELINE = path.join(packageRoot, "pipelines", "default.yaml");

export const PACKAGED_AGENTS_DIR = path.join(packageRoot, "agents");

/** Where a project puts its own copy of a phase, to override the packaged one. */
export function projectAgentsDir(projectDir: string): string {
  return path.join(projectDir, ".taskflow", "agents");
}

/**
 * A project's own flow, if it wrote one. Found rather than passed: a pipeline
 * that only applies when you remember the right option is one nobody runs.
 */
export function projectPipeline(projectDir: string): string | undefined {
  const file = path.join(projectDir, ".taskflow", "pipeline.yaml");

  return fs.existsSync(file) ? file : undefined;
}

/**
 * Everything in this project that would replace part of the packaged pipeline.
 *
 * Listed so it can be shown to a person before any of it runs. These files
 * arrive with the project — cloning a repository is enough to put them on your
 * disk — and they decide which phases exist and what each one is told to do.
 * Picking them up because they happen to be there is how you end up running
 * instructions written by whoever wrote the repository.
 */
export function projectCustomisations(projectDir: string): string[] {
  const pipeline = projectPipeline(projectDir);
  const agentsDir = projectAgentsDir(projectDir);

  const agents = fs.existsSync(agentsDir)
    ? fs
        .readdirSync(agentsDir)
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => path.join(agentsDir, entry))
    : [];

  return [...(pipeline ? [pipeline] : []), ...agents];
}

export function runsDir(projectDir: string): string {
  return path.join(projectDir, ".taskflow", "runs");
}

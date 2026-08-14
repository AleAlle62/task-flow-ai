import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where the packaged files live, whether we run from `dist/` after a build or
 * straight from `src/` under tsx. Both sit one level below the package root.
 */
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_PIPELINE = path.join(packageRoot, "pipelines", "default.yaml");

export const PACKAGED_AGENTS_DIR = path.join(packageRoot, "agents");

/** Where a project puts its own copy of a phase, to override the packaged one. */
export function projectAgentsDir(projectDir: string): string {
  return path.join(projectDir, ".taskflow", "agents");
}

export function runsDir(projectDir: string): string {
  return path.join(projectDir, ".taskflow", "runs");
}

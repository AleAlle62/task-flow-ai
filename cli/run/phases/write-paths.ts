import { execFileSync } from "node:child_process";

import { matchesAny } from "../../util/glob.js";

/**
 * Checks what the writing phase actually touched against the paths it was
 * allowed to touch.
 *
 * This is a check after the fact, not a wall. No agent CLI offers a reliable
 * path whitelist, so the honest thing is to look at the result and fail loudly
 * — the files are left exactly as the phase wrote them, because deciding on
 * your behalf to undo work is worse than telling you about it.
 */

/** Everything git considers changed or new, ignored files excluded. */
export function changedFiles(projectDir: string): string[] {
  try {
    const output = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output
      .split("\n")
      .map((entry) => entry.slice(3).trim())
      .filter((path) => path !== "")
      .map(unquote);
  } catch {
    return [];
  }
}

/**
 * Files outside the fence that this phase is responsible for.
 *
 * `before` is the same list taken just before the phase ran, and subtracting it
 * is the whole point: a project is very often dirty when a run starts — a
 * half-finished edit, a stray note — and reporting those as violations would
 * blame the phase for work you did yourself. Worse, it would do it every single
 * run, which is how a warning stops being read.
 */
export function filesOutside(
  projectDir: string,
  patterns: string[],
  before: string[] = [],
): string[] {
  if (patterns.includes("**")) return [];

  const alreadyDirty = new Set(before);

  return changedFiles(projectDir).filter(
    (file) => !alreadyDirty.has(file) && !matchesAny(file, patterns),
  );
}

/** git quotes paths containing unusual characters. */
function unquote(path: string): string {
  return path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;
}

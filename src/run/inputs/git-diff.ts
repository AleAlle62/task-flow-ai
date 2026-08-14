import { execFileSync } from "node:child_process";

const MAX_DIFF_BYTES = 32 * 1024 * 1024;

/**
 * Everything the working tree has changed against HEAD, including files git has
 * never seen.
 *
 * When it cannot be worked out, the phase is told so in words. A phase handed
 * an empty diff would report that the implementation did nothing, which is a
 * confident wrong answer — the worst kind for the phases downstream.
 */
export function currentDiff(projectDir: string): string {
  try {
    const tracked = git(projectDir, ["diff", "HEAD"]);
    const untracked = git(projectDir, ["ls-files", "--others", "--exclude-standard"])
      .split("\n")
      .filter((path) => path.trim() !== "");

    if (untracked.length === 0) {
      return tracked.trim() === "" ? "(the working tree is unchanged)" : tracked;
    }

    const listed = untracked.map((file) => `  ${file}`).join("\n");

    return `${tracked}\n\n--- untracked files ---\n${listed}\n`;
  } catch {
    return "(could not compute a diff: this project is not a git repository)";
  }
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_DIFF_BYTES,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

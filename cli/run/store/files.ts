import fs from "node:fs";
import path from "node:path";

import type { RunState } from "../../model/run.js";
import { runsDir } from "../../paths.js";

/**
 * Where a run lives on disk and how it is read back. Everything in this file is
 * about files; nothing in it knows what a phase is.
 */

export function runDirectory(projectDir: string, runId: string): string {
  return path.join(runsDir(projectDir), runId);
}

export function createRunDirectory(projectDir: string, runId: string): string {
  const dir = runDirectory(projectDir, runId);

  fs.mkdirSync(dir, { recursive: true });
  ensureIgnored(projectDir);

  return dir;
}

export function readState(dir: string): RunState | undefined {
  const file = statePath(dir);
  if (!fs.existsSync(file)) return undefined;

  return JSON.parse(fs.readFileSync(file, "utf8")) as RunState;
}

export function writeState(dir: string, state: RunState): void {
  fs.writeFileSync(statePath(dir), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/** Newest first, so callers looking for "the last run" read in order. */
export function listRunIds(projectDir: string): string[] {
  const dir = runsDir(projectDir);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir).sort().reverse();
}

export function removeRunDirectory(projectDir: string, runId: string): void {
  fs.rmSync(runDirectory(projectDir, runId), { recursive: true, force: true });
}

/**
 * Runs are working files, like logs: they stay on the machine that made them.
 * Writing this once means nobody has to remember to edit their own .gitignore,
 * and nothing a phase read reaches a pull request by accident.
 */
function ensureIgnored(projectDir: string): void {
  const taskflowDir = path.join(projectDir, ".taskflow");
  const gitignore = path.join(taskflowDir, ".gitignore");

  if (fs.existsSync(gitignore)) return;

  fs.mkdirSync(taskflowDir, { recursive: true });
  fs.writeFileSync(
    gitignore,
    "# Runs are local working files. Delete this to commit them instead.\n*\n!.gitignore\n",
    "utf8",
  );
}

function statePath(dir: string): string {
  return path.join(dir, "run.json");
}

import { execFileSync } from "node:child_process";

import { COMPUTED_INPUTS, GATE_INPUT_PREFIX, type Phase } from "../model/types.js";
import { ConfigError } from "../util/guards.js";
import type { RunStore } from "./store.js";

const MAX_DIFF_BYTES = 32 * 1024 * 1024;

/**
 * Builds the message a phase receives: the contents of everything it is
 * entitled to read, and nothing else.
 *
 * The contents are pasted in rather than referenced by path. It costs a few
 * kilobytes and it means a phase can run on a provider that has no way to open
 * a file at all — which is the difference between supporting any agent and
 * supporting the agents that happen to have a filesystem.
 */
export function buildPhaseInput(phase: Phase, store: RunStore, projectDir: string): string {
  const blocks = phase.inputs
    .map((name) => resolve(name, phase, store, projectDir))
    .filter((block): block is Block => block !== undefined)
    .map(({ name, content }) => `<input name="${name}">\n${content.trim()}\n</input>`);

  return [
    `You are running the "${phase.id}" phase of a pipeline.`,
    ``,
    `Below is everything the phases before you produced. Nothing else is`,
    `available to you: if something you need is missing, say so in your output`,
    `instead of inventing it.`,
    ``,
    ...blocks,
    ``,
    `Write the content of \`${phase.output}\` and nothing else. No preamble, no`,
    `closing summary, no commentary about the pipeline.`,
  ].join("\n");
}

interface Block {
  name: string;
  content: string;
}

function resolve(
  name: string,
  phase: Phase,
  store: RunStore,
  projectDir: string,
): Block | undefined {
  if (name === "task") {
    return { name, content: store.current.task };
  }

  if (name === "diff") {
    return { name, content: currentDiff(projectDir) };
  }

  if (name.startsWith(GATE_INPUT_PREFIX)) {
    return gateNote(name, store);
  }

  if (!store.hasArtifact(name)) {
    throw new ConfigError(
      `phase "${phase.id}" needs "${name}", which no earlier phase produced in this run.`,
    );
  }

  return { name, content: store.readArtifact(name) };
}

/** `gates.plan-ai.note` is what the person wrote when they approved or rejected. */
function gateNote(input: string, store: RunStore): Block | undefined {
  const phaseId = input.slice(GATE_INPUT_PREFIX.length).replace(/\.note$/, "");
  const file = `gates-${phaseId}.md`;

  if (!store.hasArtifact(file)) return undefined;

  return { name: input, content: store.readArtifact(file) };
}

/**
 * Everything the working tree has changed against HEAD, including files git has
 * never seen. A phase told "no changes" when it cannot tell would report that
 * the implementation did nothing.
 */
function currentDiff(projectDir: string): string {
  try {
    const tracked = git(projectDir, ["diff", "HEAD"]);
    const untracked = git(projectDir, ["ls-files", "--others", "--exclude-standard"])
      .split("\n")
      .filter((path) => path.trim() !== "");

    if (untracked.length === 0) {
      return tracked.trim() === "" ? "(the working tree is unchanged)" : tracked;
    }

    return `${tracked}\n\n--- untracked files ---\n${untracked.map((f) => `  ${f}`).join("\n")}\n`;
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

export const COMPUTED = COMPUTED_INPUTS;

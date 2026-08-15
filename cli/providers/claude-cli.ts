import type { Capability } from "../model/capabilities.js";
import { CommandTimeout, runCommand, type CommandResult } from "../util/spawn.js";
import { isRecord } from "../util/guards.js";
import { ProviderError, type PhaseRequest, type PhaseResult, type Provider } from "./types.js";

/** Overridable so a non-standard install does not need the binary on PATH. */
const BIN = process.env["TASKFLOW_CLAUDE_BIN"] ?? "claude";

const PREFLIGHT_TIMEOUT_MS = 15_000;

/**
 * The translation, and the only place in the project where a Claude Code tool
 * name is written down.
 *
 * `inspect` maps to Bash, but Bash pre-approved for a fixed list of commands
 * rather than Bash outright — see READ_ONLY_COMMANDS. `execute` maps to the same
 * tool with nothing held back, which is why it counts as a writing capability.
 */
const TOOLS: Record<Capability, string[]> = {
  read: ["Read"],
  search: ["Grep", "Glob"],
  inspect: ["Bash"],
  execute: ["Bash"],
  write: ["Write", "Edit"],
};

/**
 * The commands a phase with `inspect` may run, and the reason `inspect` can be
 * offered at all.
 *
 * Every one of them only reads. The obvious conveniences are missing on
 * purpose: `find` takes `-delete` and `-exec`, `fd` takes `-x`, `sed` takes
 * `-i`, and `awk` writes files on its own — each would hand back the whole
 * capability the moment a phase reached for it. Anything not on this list is
 * refused by the permission system rather than by a sentence in a prompt.
 */
const READ_ONLY_COMMANDS = [
  "git log",
  "git diff",
  "git show",
  "git status",
  "git blame",
  "git ls-files",
  "rg",
  "grep",
  "ls",
  "cat",
  "head",
  "tail",
  "wc",
  "file",
  "tree",
];

/**
 * Runs the Claude Code CLI once per phase, non-interactively.
 *
 * Two flags do the security work. `--tools` decides which tools exist for the
 * phase at all, so a phase without `write` has no Write to reach for.
 * `--allowed-tools` pre-approves exactly what that phase may do, because in
 * print mode a permission prompt is a failed tool call rather than a question —
 * which is what turns the `inspect` command list into a wall.
 */
export class ClaudeCliProvider implements Provider {
  readonly id = "claude-cli";
  readonly enforcement = "tools" as const;

  async preflight(): Promise<void> {
    try {
      await runCommand(BIN, ["--version"], { timeoutMs: PREFLIGHT_TIMEOUT_MS });
    } catch {
      throw new ProviderError(
        `provider "claude-cli" needs the \`claude\` command on your PATH.\n` +
          `Install Claude Code, or point TASKFLOW_CLAUDE_BIN at the binary.`,
      );
    }

    if ((await isLoggedIn()) === false) {
      throw new ProviderError(
        `provider "claude-cli" is not signed in.\nRun \`claude auth login\`, then start again.`,
      );
    }
  }

  async run(request: PhaseRequest): Promise<PhaseResult> {
    const result = await this.invoke(request);
    const payload = parseJsonResult(result);

    const text = typeof payload["result"] === "string" ? payload["result"] : "";

    if (payload["is_error"] === true || result.code !== 0) {
      throw describeFailure(text, result.stderr);
    }

    if (text.trim() === "") {
      throw new ProviderError(`provider "claude-cli" returned an empty answer`);
    }

    return {
      text,
      costUsd: numberOrUndefined(payload["total_cost_usd"]),
      durationMs: numberOrUndefined(payload["duration_ms"]),
      raw: payload,
    };
  }

  private async invoke(request: PhaseRequest): Promise<CommandResult> {
    try {
      return await runCommand(BIN, buildArgs(request), {
        input: request.input,
        cwd: request.cwd,
        timeoutMs: request.timeoutMs,
      });
    } catch (err) {
      if (err instanceof CommandTimeout) throw new ProviderError(`phase ${err.message}`);
      throw err;
    }
  }
}

/**
 * Only the writing phase gets edits applied without asking; the read-only
 * phases have no writing tool to approve in the first place.
 */
function buildArgs(request: PhaseRequest): string[] {
  const args = [
    "--print",
    "--output-format",
    "json",
    "--system-prompt",
    request.instructions,
    "--tools",
    toolNames(request.capabilities).join(","),
    "--allowed-tools",
    ...permissionRules(request.capabilities),
  ];

  if (request.model) args.push("--model", request.model);
  if (request.canWrite) args.push("--permission-mode", "acceptEdits");

  return args;
}

/** Which tools exist for this phase at all. */
export function toolNames(capabilities: Capability[]): string[] {
  return unique(capabilities.flatMap((capability) => TOOLS[capability]));
}

/**
 * What the phase may do with them, which is not the same list.
 *
 * `inspect` on its own becomes Bash narrowed to the read-only commands.
 * `execute` widens it back to all of Bash, so a phase holding both is not
 * accidentally restricted by the narrower of the two.
 *
 * Passed as separate arguments rather than one comma-joined string because the
 * rules contain spaces: `Bash(git log:*)` comma-joined would be split apart.
 */
function permissionRules(capabilities: Capability[]): string[] {
  const rules = capabilities
    .filter((capability) => capability !== "inspect" && capability !== "execute")
    .flatMap((capability) => TOOLS[capability]);

  if (capabilities.includes("execute")) {
    rules.push("Bash");
  } else if (capabilities.includes("inspect")) {
    rules.push(...READ_ONLY_COMMANDS.map((command) => `Bash(${command}:*)`));
  }

  return unique(rules);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Whether the session is usable, asked before anything is spent or typed.
 *
 * Undefined means the question could not be answered — an older CLI without
 * this subcommand, say. That is not a reason to refuse to run: the first phase
 * will report the real problem if there is one.
 */
async function isLoggedIn(): Promise<boolean | undefined> {
  try {
    const { stdout } = await runCommand(BIN, ["auth", "status"], {
      timeoutMs: PREFLIGHT_TIMEOUT_MS,
    });

    const parsed: unknown = JSON.parse(stdout.trim());

    return isRecord(parsed) && typeof parsed["loggedIn"] === "boolean"
      ? parsed["loggedIn"]
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * An expired session is the failure people hit most often, and the raw message
 * does not say what to do about it.
 */
function describeFailure(text: string, stderr: string): ProviderError {
  const detail = text.trim() || stderr.trim() || "no details reported";

  if (/authenticate|OAuth|API key|credit balance/i.test(detail)) {
    return new ProviderError(
      `provider "claude-cli" could not authenticate: ${detail}\n` +
        `Run \`claude\` once, sign in, then start this run again.`,
    );
  }

  return new ProviderError(`provider "claude-cli" failed: ${detail}`);
}

/** The CLI prints one JSON object, but tolerate anything printed before it. */
function parseJsonResult(result: CommandResult): Record<string, unknown> {
  const lines = result.stdout.trim().split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line?.startsWith("{")) continue;

    try {
      const parsed: unknown = JSON.parse(line);
      if (isRecord(parsed)) return parsed;
    } catch {
      continue;
    }
  }

  throw new ProviderError(
    `provider "claude-cli" returned no parseable JSON (exit ${result.code}).\n` +
      `stderr: ${excerpt(result.stderr)}\nstdout: ${excerpt(result.stdout)}`,
  );
}

function excerpt(text: string): string {
  return text.trim().slice(0, 800) || "(empty)";
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

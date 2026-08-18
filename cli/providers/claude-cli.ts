import type { Capability } from "../model/capabilities.js";
import { sandboxSettings } from "./claude-sandbox.js";
import { advice, classify, withRetry } from "../errors/retry.js";
import { dim, line } from "../ui.js";
import { CommandTimeout, CommandTooLoud, runCommand, type CommandResult } from "../util/spawn.js";
import { isRecord } from "../util/guards.js";
import { ProviderError, type PhaseRequest, type PhaseResult, type Provider } from "./types.js";

/** Overridable so a non-standard install does not need the binary on PATH. */
const BIN = process.env["TASKFLOW_CLAUDE_BIN"] ?? "claude";

const PREFLIGHT_TIMEOUT_MS = 15_000;

/** The first try plus two more: enough for a blip, short of a hang. */
const ATTEMPTS = 3;

const RETRY_BASE_MS = 2_000;

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
 * The translation, and the only place in the project where a Claude Code tool
 * name is written down.
 *
 * Two columns because they are two different questions, and the answers are not
 * the same list. `tools` is which tools exist for the phase at all — a phase
 * without `write` has no Write to reach for. `allow` is what may be done with
 * them without a prompt, which matters because in print mode a permission
 * prompt is a failed tool call, not a question.
 *
 * `inspect` is where they come apart: the tool is Bash, the permission is Bash
 * narrowed to the commands above. `execute` is the same tool with nothing held
 * back, which is why it counts as a writing capability. A phase holding both
 * ends up with the wide rule and the narrow ones together, and the wide one
 * wins — an allowlist is a union, so there is nothing to disentangle.
 */
const CLAUDE_TOOLS: Record<Capability, { tools: string[]; allow: string[] }> = {
  read: { tools: ["Read"], allow: ["Read"] },
  search: { tools: ["Grep", "Glob"], allow: ["Grep", "Glob"] },
  inspect: { tools: ["Bash"], allow: READ_ONLY_COMMANDS.map((command) => `Bash(${command}:*)`) },
  execute: { tools: ["Bash"], allow: ["Bash"] },
  write: { tools: ["Write", "Edit"], allow: ["Write", "Edit"] },
};

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

  /**
   * One phase, with the outside world's bad afternoons absorbed.
   *
   * The retry wraps the reading of the answer as well as the call itself, and
   * that is the whole point: this CLI reports a dropped connection *inside* a
   * perfectly successful process, as an error in its JSON. Retrying only the
   * spawn would therefore retry none of the failures that are actually worth
   * retrying.
   *
   * What is worth repeating is decided in `errors/`. A phase that ran out of
   * time or drowned us in output is refused here whatever it looks like: it
   * would only do the same again, more slowly.
   */
  run(request: PhaseRequest): Promise<PhaseResult> {
    return withRetry(
      () => this.once(request),
      {
        attempts: ATTEMPTS,
        baseDelayMs: RETRY_BASE_MS,
        onRetry: ({ attempt, of, waitMs, failure, detail }) => {
          line();
          line(dim(`  ${failure} — ${headline(detail)}`));
          line(dim(`  trying again in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1} of ${of})`));
        },
      },
      (error) => error instanceof CommandTimeout || error instanceof CommandTooLoud,
    );
  }

  private async once(request: PhaseRequest): Promise<PhaseResult> {
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
      ...countTokens(payload["usage"]),
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
      if (err instanceof CommandTimeout || err instanceof CommandTooLoud) {
        throw new ProviderError(`phase ${err.message}`);
      }
      throw err;
    }
  }
}

/**
 * Only the writing phase gets edits applied without asking; the read-only
 * phases have no writing tool to approve in the first place.
 *
 * This list of arguments is the security boundary on this provider —
 * everything else in the file is plumbing.
 */
function buildArgs(request: PhaseRequest): string[] {
  const args = [
    "--print",
    "--output-format",
    "json",
    "--settings",
    sandboxSettings(),
    "--system-prompt",
    request.instructions,
    "--tools",
    translate(request.capabilities, "tools").join(","),
    "--allowed-tools",
    ...translate(request.capabilities, "allow"),
  ];

  if (request.model) args.push("--model", request.model);
  if (request.canWrite) args.push("--permission-mode", "acceptEdits");

  return args;
}

/**
 * One column of the table for one phase.
 *
 * The permission rules are passed as separate arguments rather than one
 * comma-joined string because they contain spaces: `Bash(git log:*)`
 * comma-joined would be split apart.
 */
function translate(capabilities: Capability[], column: "tools" | "allow"): string[] {
  return [...new Set(capabilities.flatMap((capability) => CLAUDE_TOOLS[capability][column]))];
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
  const hint = advice(classify(detail));

  return new ProviderError(
    `provider "claude-cli" failed: ${detail}` + (hint ? `\n${hint}` : ""),
  );
}

/** Retry notices sit under a running phase, so they get one line, not a paragraph. */
function headline(detail: string): string {
  const first = detail.trim().split("\n")[0] ?? "";

  return first.length > 110 ? `${first.slice(0, 107)}...` : first;
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

/**
 * How much the phase read and how much it wrote.
 *
 * The three input counts are added together because they are all context the
 * model was given: tokens sent fresh, tokens read back from the cache, and
 * tokens written into it. Reporting only `input_tokens` would show a phase that
 * read your whole codebase as having read almost nothing, since nearly all of
 * it arrives as a cache read.
 */
function countTokens(raw: unknown): { tokensIn?: number; tokensOut?: number } {
  if (!isRecord(raw)) return {};

  const tokensIn =
    (numberOrUndefined(raw["input_tokens"]) ?? 0) +
    (numberOrUndefined(raw["cache_read_input_tokens"]) ?? 0) +
    (numberOrUndefined(raw["cache_creation_input_tokens"]) ?? 0);

  const tokensOut = numberOrUndefined(raw["output_tokens"]);

  return {
    ...(tokensIn > 0 ? { tokensIn } : {}),
    ...(tokensOut === undefined ? {} : { tokensOut }),
  };
}

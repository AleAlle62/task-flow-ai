import { CommandTimeout, runCommand, type CommandResult } from "../util/spawn.js";
import { isRecord } from "../util/guards.js";
import { ProviderError, type PhaseRequest, type PhaseResult, type Provider } from "./types.js";

/** Overridable so a non-standard install does not need the binary on PATH. */
const BIN = process.env["TASKFLOW_CLAUDE_BIN"] ?? "claude";

const PREFLIGHT_TIMEOUT_MS = 15_000;

/**
 * Runs the Claude Code CLI once per phase, non-interactively.
 *
 * Two flags do the security work. `--tools` decides which tools exist for the
 * phase at all, so a read-only phase has no Write to reach for. `--allowed-tools`
 * pre-approves exactly that set, because in print mode a permission prompt is a
 * failed tool call rather than a question.
 */
export class ClaudeCliProvider implements Provider {
  readonly id = "claude-cli";
  readonly enforcesTools = true;

  async preflight(): Promise<void> {
    try {
      await runCommand(BIN, ["--version"], { timeoutMs: PREFLIGHT_TIMEOUT_MS });
    } catch {
      throw new ProviderError(
        `provider "claude-cli" needs the \`claude\` command on your PATH.\n` +
          `Install Claude Code, or point TASKFLOW_CLAUDE_BIN at the binary.`,
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
  const tools = request.tools.join(",");

  const args = [
    "--print",
    "--output-format",
    "json",
    "--system-prompt",
    request.instructions,
    "--tools",
    tools,
    "--allowed-tools",
    tools,
  ];

  if (request.model) args.push("--model", request.model);
  if (request.canWrite) args.push("--permission-mode", "acceptEdits");

  return args;
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

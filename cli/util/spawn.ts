import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * `input` is sent on stdin rather than as an argument: phase input carries
 * whole artifacts, and argv has a hard length limit we would eventually hit.
 */
export interface CommandOptions {
  input?: string;
  cwd?: string;
  timeoutMs: number;
}

export class CommandTimeout extends Error {
  constructor(seconds: number) {
    super(`exceeded its ${seconds}s timeout and was killed`);
    this.name = "CommandTimeout";
  }
}

/** How long a process gets to die politely before it is killed outright. */
const GRACE_MS = 5_000;

/**
 * Runs a command to completion without a shell, so nothing inside a prompt can
 * be read as shell syntax.
 */
export function runCommand(
  bin: string,
  args: string[],
  options: CommandOptions,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), GRACE_MS).unref();
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new CommandTimeout(Math.round(options.timeoutMs / 1000)));
        return;
      }
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    ignoreBrokenPipe(child);
    child.stdin.end(options.input ?? "");
  });
}

/**
 * A child may exit before reading all of stdin. Its exit code is the real
 * signal, so a broken pipe here is not worth failing the command on.
 */
function ignoreBrokenPipe(child: ReturnType<typeof spawn>): void {
  child.stdin?.on("error", () => {});
}

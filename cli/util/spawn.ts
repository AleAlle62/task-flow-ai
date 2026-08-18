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

export class CommandTooLoud extends Error {
  constructor(limitMb: number) {
    super(`produced more than ${limitMb} MB of output and was killed`);
    this.name = "CommandTooLoud";
  }
}

/**
 * A phase writes one document. Anything past this is a loop, not an artifact,
 * and holding it in memory to find that out helps nobody.
 */
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

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

    const out = new Chunks();
    const err = new Chunks();
    let timedOut = false;
    let tooLoud = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), GRACE_MS).unref();
    }, options.timeoutMs);

    const stop = () => {
      tooLoud = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), GRACE_MS).unref();
    };

    child.stdout.on("data", (chunk: Buffer) => {
      if (out.add(chunk) > MAX_OUTPUT_BYTES && !tooLoud) stop();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (err.add(chunk) > MAX_OUTPUT_BYTES && !tooLoud) stop();
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

      if (tooLoud) {
        reject(new CommandTooLoud(Math.round(MAX_OUTPUT_BYTES / 1024 / 1024)));
        return;
      }

      resolve({ stdout: out.text(), stderr: err.text(), code: code ?? 1 });
    });

    ignoreBrokenPipe(child);
    child.stdin.end(options.input ?? "");
  });
}

/**
 * What a stream said, kept as bytes until the very end.
 *
 * Decoding each chunk as it arrives looks equivalent and is not: a chunk
 * boundary falls wherever the pipe happens to break, which is regularly in the
 * middle of a multi-byte character, and each one of those becomes a replacement
 * character in the artifact. Measured: ~800 KB of accented text came back with
 * 24 characters destroyed. Joining the bytes first makes the boundary a
 * non-event, and it also makes the size limit a count of bytes rather than of
 * UTF-16 units, which is what it always claimed to be.
 */
class Chunks {
  private readonly parts: Buffer[] = [];
  private size = 0;

  /** Returns the total byte length so far, so the caller can cap it. */
  add(chunk: Buffer): number {
    this.parts.push(chunk);
    this.size += chunk.length;

    return this.size;
  }

  text(): string {
    return Buffer.concat(this.parts).toString("utf8");
  }
}

/**
 * A child may exit before reading all of stdin. Its exit code is the real
 * signal, so a broken pipe here is not worth failing the command on.
 */
function ignoreBrokenPipe(child: ReturnType<typeof spawn>): void {
  child.stdin?.on("error", () => {});
}

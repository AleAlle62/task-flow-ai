import fs from "node:fs";
import type { ServerResponse } from "node:http";

import { SAFE_HEADERS } from "./headers.js";

/** How often the log is checked for new lines when the filesystem stays quiet. */
const POLL_MS = 400;

/**
 * Streams a run's event log to a browser over Server-Sent Events.
 *
 * The log is append-only, so following it is just remembering how many bytes
 * have been sent and shipping whatever appears after that. A client that
 * connects late is not left guessing: it receives everything from the start,
 * then continues live.
 *
 * The file is asked for on every tick rather than resolved once, because the
 * dashboard outlives a single run: ask it for a second task and a new run
 * directory appears underneath. Bound once, the stream went on watching a file
 * nothing would ever append to again, and the page fell back to its slow poll
 * without saying so.
 */
export function streamEvents(fileNow: () => string | undefined, response: ServerResponse): void {
  response.writeHead(200, {
    ...SAFE_HEADERS,
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  let following: string | undefined;
  let offset = 0;
  let partial = "";

  const flush = () => {
    const file = fileNow();
    if (!file) return;

    /* A different run: start it from its first line rather than from a byte
     * count that belonged to another file. */
    if (file !== following) {
      following = file;
      offset = 0;
      partial = "";
    }

    if (!fs.existsSync(file)) return;

    const size = fs.statSync(file).size;
    if (size <= offset) return;

    const chunk = readFrom(file, offset, size);
    offset += chunk.length;

    const lines = (partial + chunk.toString("utf8")).split("\n");

    /* Whatever follows the last newline is half a line: an append caught
     * mid-write, or a multi-byte character split across two reads. It is kept
     * for the next tick instead of being sent as a line nobody can parse —
     * which is how an event used to be dropped for good. */
    partial = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim() !== "") response.write(`data: ${line}\n\n`);
    }
  };

  flush();

  const timer = setInterval(flush, POLL_MS);

  response.on("close", () => clearInterval(timer));
}

/**
 * The bytes between two offsets, however many the kernel felt like giving us.
 *
 * A single `read` may return fewer bytes than asked for, and the buffer it was
 * asked to fill is zero-filled — so trusting the request size rather than the
 * answer is how NUL bytes end up in the middle of an event stream.
 */
function readFrom(file: string, start: number, end: number): Buffer {
  const handle = fs.openSync(file, "r");

  try {
    const buffer = Buffer.alloc(end - start);
    const read = fs.readSync(handle, buffer, 0, buffer.length, start);

    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(handle);
  }
}

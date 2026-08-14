import fs from "node:fs";
import type { ServerResponse } from "node:http";

/** How often the log is checked for new lines when the filesystem stays quiet. */
const POLL_MS = 400;

/**
 * Streams a run's event log to a browser over Server-Sent Events.
 *
 * The log is append-only, so following it is just remembering how many bytes
 * have been sent and shipping whatever appears after that. A client that
 * connects late is not left guessing: it receives everything from the start,
 * then continues live.
 */
export function streamEvents(file: string, response: ServerResponse): () => void {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  let offset = 0;

  const flush = () => {
    if (!fs.existsSync(file)) return;

    const size = fs.statSync(file).size;
    if (size <= offset) return;

    const chunk = readFrom(file, offset, size);
    offset = size;

    for (const line of chunk.split("\n")) {
      if (line.trim() !== "") response.write(`data: ${line}\n\n`);
    }
  };

  flush();

  const timer = setInterval(flush, POLL_MS);

  const stop = () => {
    clearInterval(timer);
    response.end();
  };

  response.on("close", () => clearInterval(timer));

  return stop;
}

function readFrom(file: string, start: number, end: number): string {
  const handle = fs.openSync(file, "r");

  try {
    const buffer = Buffer.alloc(end - start);
    fs.readSync(handle, buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(handle);
  }
}

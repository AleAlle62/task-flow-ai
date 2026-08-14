import fs from "node:fs";

import type { RunEvent } from "../../model/run.js";

/**
 * The event log: one JSON object per line, appended and never rewritten.
 *
 * Nothing reads it yet. It exists now because the dashboard will stream it
 * later, and a log that starts halfway through the project is a log with a hole
 * in it.
 */
export class EventLog {
  constructor(
    private readonly file: string,
    private readonly runId: string,
  ) {}

  append(type: string, data: Record<string, unknown> = {}): void {
    const event: RunEvent = {
      ts: new Date().toISOString(),
      run: this.runId,
      type,
      ...data,
    };

    fs.appendFileSync(this.file, `${JSON.stringify(event)}\n`, "utf8");
  }

  /** Every event so far, in order. Used to resume a run and by the dashboard. */
  readAll(): RunEvent[] {
    if (!fs.existsSync(this.file)) return [];

    return fs
      .readFileSync(this.file, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as RunEvent);
  }
}

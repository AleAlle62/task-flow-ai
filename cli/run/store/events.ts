import fs from "node:fs";

import type { RunEvent } from "../../model/run.js";

/**
 * The event log: one JSON object per line, appended and never rewritten.
 *
 * The dashboard follows it live, and it is the record of what happened, in
 * order, for anyone reading the run afterwards.
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
}

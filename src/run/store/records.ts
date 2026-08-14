import type { PhaseRecord } from "../../model/run.js";

/**
 * How a phase's record changes as it runs. Pure functions over plain data: no
 * file is touched here, so the bookkeeping can be read in one sitting and the
 * store is left with one job, which is putting it on disk.
 */

export function started(id: string, output: string): PhaseRecord {
  return { id, status: "running", output, startedAt: new Date().toISOString() };
}

export function completed(record: PhaseRecord, costUsd?: number): PhaseRecord {
  return {
    ...record,
    ...ended(record),
    status: "done",
    ...(costUsd === undefined ? {} : { costUsd }),
  };
}

export function failed(record: PhaseRecord, error: string): PhaseRecord {
  return { ...record, ...ended(record), status: "failed", error };
}

/** Replaces a phase's record, or appends it the first time it runs. */
export function replace(records: PhaseRecord[], record: PhaseRecord): PhaseRecord[] {
  const others = records.filter((entry) => entry.id !== record.id);
  return [...others, record];
}

export function find(records: PhaseRecord[], id: string): PhaseRecord | undefined {
  return records.find((record) => record.id === id);
}

function ended(record: PhaseRecord): Pick<PhaseRecord, "endedAt" | "durationMs"> {
  const endedAt = new Date().toISOString();
  const startedAt = record.startedAt;

  return {
    endedAt,
    ...(startedAt ? { durationMs: Date.parse(endedAt) - Date.parse(startedAt) } : {}),
  };
}

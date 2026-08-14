import type { PhaseRecord } from "../../model/run.js";

/**
 * How a phase's record changes as it runs. Pure functions over plain data: no
 * file is touched here, so the bookkeeping can be read in one sitting and the
 * store is left with one job, which is putting it on disk.
 */

/**
 * A phase the run intends to reach but has not started. Seeding these means a
 * watcher can draw the whole pipeline from the first second, instead of
 * discovering it one phase at a time as it happens.
 */
export function planned(id: string, output: string): PhaseRecord {
  return { id, status: "pending", output };
}

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

/**
 * Replaces a phase's record in place, or appends it if it is new.
 *
 * In place matters: a phase that runs twice during a correction loop must stay
 * where it is in the list, or the pipeline appears to reorder itself while you
 * are watching it.
 */
export function replace(records: PhaseRecord[], record: PhaseRecord): PhaseRecord[] {
  const index = records.findIndex((entry) => entry.id === record.id);

  if (index === -1) return [...records, record];

  const next = [...records];
  next[index] = record;

  return next;
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

import { randomBytes } from "node:crypto";

/**
 * Sortable by name, so `ls` shows runs in the order they happened, and unique
 * enough that two runs started in the same second do not collide.
 *
 * UTC, like every other timestamp we write. A run directory named in local time
 * and full of UTC timestamps reads as two different moments.
 */
export function newRunId(now: Date = new Date()): string {
  const [date, time] = now.toISOString().split("T") as [string, string];

  return [
    date.replaceAll("-", ""),
    time.slice(0, 8).replaceAll(":", ""),
    randomBytes(2).toString("hex"),
  ].join("-");
}

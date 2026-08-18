import { RunStore } from "../run/store/store.js";
import { parseArgs } from "../util/args.js";
import { ConfigError } from "../util/guards.js";
import { bold, dim, line } from "../ui.js";

const OPTIONS = ["keep"] as const;

/** Finished runs beyond this many are removed by default. */
const DEFAULT_KEEP = 20;

/**
 * Deletes old run directories under `.taskflow/runs`.
 *
 * Only finished runs are candidates, and only the oldest beyond `--keep` are
 * removed — a run that never reached "done" may be the one thing someone
 * means to resume, so it is left alone no matter its age.
 */
export async function clean(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv, OPTIONS);
  const keep = flags["keep"] !== undefined ? Number(flags["keep"]) : DEFAULT_KEEP;

  if (!Number.isInteger(keep) || keep < 0) {
    throw new ConfigError(`--keep needs a non-negative integer, got "${flags["keep"]}"`);
  }

  const removed = RunStore.prune(process.cwd(), keep);

  if (removed.length === 0) {
    line(dim("nothing to remove"));
    return 0;
  }

  line(bold(`removed ${removed.length} finished run${removed.length === 1 ? "" : "s"}:`));
  for (const id of removed) line(dim(`  ${id}`));
  line(dim(`kept the ${keep} most recent, and any run still unfinished`));

  return 0;
}

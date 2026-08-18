import { advice, backoffMs, classify, worthRetrying, type Failure } from "./failures.js";

export interface RetryReport {
  attempt: number;
  of: number;
  waitMs: number;
  failure: Failure;
  detail: string;
}

export interface RetryOptions {
  /** Total attempts, including the first. Two retries is the useful range. */
  attempts: number;
  baseDelayMs: number;
  /** Told about each wait, so a person is never watching an idle screen. */
  onRetry: (report: RetryReport) => void;
}

/**
 * Runs something that talks to the outside world, and tries again when the
 * outside world was merely busy.
 *
 * A phase costs real money and real minutes, so a connection that drops for two
 * seconds in the fourth phase should not end a run that has already paid for
 * three. Equally, a run should not sit there retrying an expired session: what
 * is retried is decided by `failures.ts` and nothing else.
 *
 * `refuse` is for the failures the caller knows are not worth repeating whatever
 * they look like — a phase that ran out of time will run out of time again, and
 * waiting for that twice helps nobody.
 */
export async function withRetry<T>(
  work: () => Promise<T>,
  options: RetryOptions,
  refuse: (error: unknown) => boolean = () => false,
): Promise<T> {
  let attempt = 1;

  for (;;) {
    try {
      return await work();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const failure = classify(detail);

      if (attempt >= options.attempts || refuse(error) || !worthRetrying(failure)) throw error;

      const waitMs = backoffMs(failure, attempt, options.baseDelayMs);

      options.onRetry({ attempt, of: options.attempts, waitMs, failure, detail });

      await sleep(waitMs);
      attempt++;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { advice, classify, worthRetrying, type Failure };

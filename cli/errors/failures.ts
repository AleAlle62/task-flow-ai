/**
 * What kind of failure this is, and therefore what to do about it.
 *
 * Everything that goes wrong during a run arrives as text — a line from an
 * agent CLI, a socket error from Node — and the only question that matters is
 * whether trying again could plausibly help. Answering it in one table, in one
 * place, is what stops the answer from being given differently in four.
 */
export type Failure = "network" | "overloaded" | "auth" | "quota" | "limit" | "unknown";

/**
 * Read in order, first match wins, so the specific sits above the general.
 *
 * `auth` and `quota` are listed before the network patterns on purpose: an
 * expired session often surfaces alongside a connection message, and retrying
 * that pair forever is how a tool burns twenty minutes to arrive at a problem
 * it could have named immediately.
 */
const PATTERNS: [Failure, RegExp][] = [
  ["auth", /authenticat|unauthori[sz]ed|oauth|invalid api key|api key|forbidden|401|403/i],
  ["quota", /credit balance|insufficient (credit|quota|funds)|billing|payment|quota exceeded/i],
  ["limit", /rate limit|too many requests|429/i],
  ["overloaded", /overloaded|server error|service unavailable|bad gateway|50[0234]\b/i],
  ["network", /econnreset|econnrefused|etimedout|enotfound|eai_again|epipe|socket hang up|network|fetch failed|tls|dns/i],
];

export function classify(detail: string): Failure {
  for (const [failure, pattern] of PATTERNS) {
    if (pattern.test(detail)) return failure;
  }

  return "unknown";
}

/**
 * Whether trying the same thing again could plausibly work.
 *
 * Only the three that are about the world being briefly busy. An expired
 * session and an empty wallet are not going to fix themselves between one
 * attempt and the next, and each retry of those costs a person another wait
 * before they are told the thing they could have been told at once.
 */
export function worthRetrying(failure: Failure): boolean {
  return failure === "network" || failure === "overloaded" || failure === "limit";
}

/** What a person can actually do about it, when there is something. */
export function advice(failure: Failure): string | undefined {
  switch (failure) {
    case "auth":
      return "Run `claude` once, sign in, then start this run again.";
    case "quota":
      return "Check the balance or plan on the account this agent signs in with.";
    case "limit":
      return "The account is being rate limited. Waiting a few minutes usually clears it.";
    case "network":
      return "Check the connection, then start this run again — finished phases are not repeated.";
    default:
      return undefined;
  }
}

/** How long to wait before attempt number `attempt`, in milliseconds. */
export function backoffMs(failure: Failure, attempt: number, base: number): number {
  /* Being rate limited is the one case where trying again quickly makes it
   * worse rather than better, so that one waits considerably longer. */
  const multiplier = failure === "limit" ? 4 : 1;

  return base * multiplier * 2 ** (attempt - 1);
}

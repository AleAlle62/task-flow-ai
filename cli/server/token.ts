import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A secret generated per run and required on every request.
 *
 * The server only listens on the loopback address, but that is not enough on
 * its own: any page open in your browser can also reach 127.0.0.1. Without a
 * secret it does not know, a random site could answer a gate — that is, approve
 * a plan that then writes to your code.
 */
export function newToken(): string {
  return randomBytes(24).toString("hex");
}

/** Compared in constant time so the answer cannot be guessed one byte at a time. */
export function tokenMatches(expected: string, given: string | undefined): boolean {
  if (!given || given.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/**
 * How long a ticket stays spendable. Long enough to walk away from the terminal
 * and come back, short enough that the addresses left in yesterday's scrollback
 * are not still keys to anything.
 */
const TICKET_TTL_MS = 30 * 60 * 1000;

/**
 * One-time tickets, which is how the page is let in without the real token ever
 * travelling somewhere it can be read later.
 *
 * The address the browser is opened at has to carry *something*, and whatever
 * it carries ends up in the arguments of the command that opens the browser —
 * visible to anyone who can run `ps` while it lives — as well as in the
 * terminal's scrollback. So what it carries is a ticket that stops working the
 * moment the page uses it, and the page trades it for the session token, which
 * never appears in an address bar or a process list at all.
 *
 * Being spent is not the only way a ticket ends. A run prints a fresh address
 * every time it asks you something, and the ones nobody clicked used to stay
 * valid for as long as the process lived — a dozen live keys sitting in the
 * scrollback of a terminal you have long since scrolled past, and a set that
 * only ever grew. They expire now, and the expired ones are swept on the way
 * past rather than by a timer, so nothing has to be shut down.
 */
export class Tickets {
  private readonly issued = new Map<string, number>();

  /** A fresh ticket, minted every time an address is shown to a person. */
  mint(now: number = Date.now()): string {
    this.sweep(now);

    const ticket = newToken();

    this.issued.set(ticket, now + TICKET_TTL_MS);

    return ticket;
  }

  /** True once, for a ticket that was really issued and has not expired. */
  redeem(given: string | undefined, now: number = Date.now()): boolean {
    this.sweep(now);

    if (!given) return false;

    for (const ticket of this.issued.keys()) {
      if (tokenMatches(ticket, given)) {
        this.issued.delete(ticket);
        return true;
      }
    }

    return false;
  }

  private sweep(now: number): void {
    for (const [ticket, expiresAt] of this.issued) {
      if (expiresAt <= now) this.issued.delete(ticket);
    }
  }
}

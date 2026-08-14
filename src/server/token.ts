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

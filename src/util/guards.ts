/** Small helpers for walking data that came from a file and could be anything. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item));
}

export function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Every failure the user can cause by editing a file is thrown as this, so the
 * CLI can print it plainly instead of a stack trace.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

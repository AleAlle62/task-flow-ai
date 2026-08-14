import { ConfigError } from "./guards.js";

export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string>;
}

/**
 * Parses `--name value` and `--name=value`, leaving everything else positional.
 *
 * Hand-written because the surface is four flags. When it grows past that, or
 * gains short forms and negations, it should become a real parser rather than a
 * bigger version of this.
 */
export function parseArgs(argv: string[], known: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string;

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const [name, inlineValue] = splitFlag(token);

    if (!known.includes(name)) {
      throw new ConfigError(`unknown option "--${name}". Known: ${known.map((k) => `--${k}`).join(", ")}`);
    }

    const value = inlineValue ?? argv[++i];

    if (value === undefined) {
      throw new ConfigError(`option "--${name}" needs a value`);
    }

    flags[name] = value;
  }

  return { positional, flags };
}

function splitFlag(token: string): [string, string | undefined] {
  const body = token.slice(2);
  const equals = body.indexOf("=");

  if (equals === -1) return [body, undefined];

  return [body.slice(0, equals), body.slice(equals + 1)];
}

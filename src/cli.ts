#!/usr/bin/env node

import { validate } from "./commands/validate.js";
import { DEFAULT_PIPELINE } from "./paths.js";
import { ConfigError, errorMessage } from "./util/guards.js";
import { ProviderError } from "./providers/index.js";

const USAGE = `task-flow-ai — a six-phase agent pipeline you approve from the browser.

Usage:
  task-flow-ai run "<task>"        Run the pipeline on a task
  task-flow-ai validate [file]     Check a pipeline file and show the flow
  task-flow-ai --help              Show this message
  task-flow-ai --version           Show the version
`;

const VERSION = "0.1.0";

/** Nothing but dispatch: every command's work lives in commands/. */
function main(argv: string[]): number {
  const command = argv[0];

  switch (command) {
    case undefined:
    case "--help":
    case "-h":
      process.stdout.write(USAGE);
      return 0;

    case "--version":
    case "-v":
      process.stdout.write(`${VERSION}\n`);
      return 0;

    case "validate":
      return validate(argv[1] ?? DEFAULT_PIPELINE, process.cwd());

    case "run":
      process.stderr.write("`run` is not implemented yet.\n");
      return 1;

    default:
      process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}

/**
 * A wrong file or an unusable provider is something the person can fix, and
 * they get a plain message. Anything else is our bug, and keeps its stack trace.
 */
try {
  process.exit(main(process.argv.slice(2)));
} catch (err) {
  if (err instanceof ConfigError || err instanceof ProviderError) {
    process.stderr.write(`\n${errorMessage(err)}\n`);
    process.exit(1);
  }
  throw err;
}

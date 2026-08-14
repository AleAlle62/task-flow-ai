#!/usr/bin/env node

import { run } from "./commands/run.js";
import { validate } from "./commands/validate.js";
import { DEFAULT_PIPELINE } from "./paths.js";
import { ProviderError } from "./providers/index.js";
import { ConfigError, errorMessage } from "./util/guards.js";

const USAGE = `task-flow-ai — six separate phases, and you approve the plan.

Usage:
  task-flow-ai run [task]          Run the pipeline. Without a task, the
                                  dashboard asks you for one.
  task-flow-ai validate [file]     Check a pipeline file and show the flow

Options for run:
  --pipeline <file>   Pipeline to use          (default: the packaged one)
  --provider <name>   Agent to run underneath  (default: the only one installed)
  --model <name>      Model to ask it for      (default: the provider's own)
  --cwd <dir>         Project to work on       (default: here)
  --resume <id|last>  Continue an interrupted run instead of starting one
  --port <n>          Dashboard port          (default: 4179)
  --no-web true       Ask in the terminal instead of opening a browser
`;

const VERSION = "0.1.0";

async function main(argv: string[]): Promise<number> {
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
      return await run(argv.slice(1));

    default:
      process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}

/**
 * A wrong file or an unusable provider is something the person can fix, and
 * they get a plain message. Anything else is our bug, and keeps its stack trace.
 */
main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    if (err instanceof ConfigError || err instanceof ProviderError) {
      process.stderr.write(`\n${errorMessage(err)}\n`);
      process.exit(1);
    }
    throw err;
  });

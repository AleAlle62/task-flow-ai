#!/usr/bin/env node

import { clean } from "./commands/clean.js";
import { run } from "./commands/run.js";
import { ProviderError } from "./providers/index.js";
import { ConfigError, errorMessage } from "./util/guards.js";

const USAGE = `task-flow-ai — six separate phases, and you approve the plan.

Usage:
  task-flow-ai run [task]     Run the pipeline in the current directory.
                              Without a task, the dashboard asks you for one.
  task-flow-ai clean          Remove old finished runs from .taskflow/runs.

Options:
  --model <name>              Model to ask the agent for (default: its own)
  --keep <n>                  Finished runs to keep, for clean (default: 20)

Everything else works itself out: an unfinished run here is offered to you, the
dashboard takes a free port, and a pipeline at .taskflow/pipeline.yaml is used
instead of the packaged one.
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

    case "run":
      return await run(argv.slice(1));

    case "clean":
      return await clean(argv.slice(1));

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

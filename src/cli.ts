#!/usr/bin/env node

const USAGE = `task-flow-ai — a six-phase agent pipeline you approve from the browser.

Usage:
  task-flow-ai run "<task>"    Run the pipeline on a task
  task-flow-ai --help          Show this message
  task-flow-ai --version       Show the version
`;

function main(argv: string[]): number {
  const command = argv[0];

  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }

  if (command === "--version" || command === "-v") {
    process.stdout.write("0.1.0\n");
    return 0;
  }

  if (command === "run") {
    process.stderr.write("`run` is not implemented yet.\n");
    return 1;
  }

  process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
  return 1;
}

process.exit(main(process.argv.slice(2)));

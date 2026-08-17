/**
 * What a phase is allowed to do, in words that belong to no vendor.
 *
 * This is the list `agents/*.md` declares and the list a provider is handed. No
 * tool name from any product appears above a provider: "Read", "Bash" and
 * "Edit" are Claude Code's vocabulary, and a pipeline written in them is a
 * pipeline that only runs on Claude Code. Each provider translates these five
 * words into whatever its own agent calls them.
 *
 * One table, because a capability has exactly two facts attached to it — what
 * it lets you do and whether it can change the user's code — and keeping those
 * in three lists that must agree is how one of them ends up disagreeing.
 *
 * `changesCode` is not the obvious flag it looks like. `execute` carries it
 * because running commands is writing: `echo x > file` and `sed -i` change your
 * project exactly as much as an editor does. Counting only the file-writing
 * tools is how a pipeline ends up with five "read-only" phases that can all
 * rewrite your repository. `inspect` is what those phases actually needed
 * commands for, and a provider may only offer it if it can hold the command
 * list down to reading; one that cannot simply does not grant it.
 *
 * Adding a capability means adding a row here and teaching every provider what
 * it means. That is deliberately a bigger decision than adding a provider.
 */
export const CAPABILITIES = {
  read: { help: "open files in the project", changesCode: false },
  search: { help: "find files and text across the project", changesCode: false },
  inspect: { help: "run read-only commands (git history, grep, listing)", changesCode: false },
  execute: { help: "run any command — CHANGES YOUR CODE", changesCode: true },
  write: { help: "create and modify files — CHANGES YOUR CODE", changesCode: true },
} as const;

export type Capability = keyof typeof CAPABILITIES;

export const CAPABILITY_NAMES = Object.keys(CAPABILITIES) as Capability[];

export function isCapability(value: string): value is Capability {
  return Object.hasOwn(CAPABILITIES, value);
}

export function changesCode(capabilities: Capability[]): boolean {
  return capabilities.some((capability) => CAPABILITIES[capability].changesCode);
}

/** The capability list as a person needs to read it, for an error message. */
export function describeCapabilities(): string {
  return CAPABILITY_NAMES.map((name) => `  ${name.padEnd(8)} ${CAPABILITIES[name].help}`).join("\n");
}

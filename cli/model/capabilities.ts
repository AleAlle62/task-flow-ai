/**
 * What a phase is allowed to do, in words that belong to no vendor.
 *
 * This is the list `agents/*.md` declares and the list a provider is handed. No
 * tool name from any product appears above a provider: "Read", "Bash" and
 * "Edit" are Claude Code's vocabulary, and a pipeline written in them is a
 * pipeline that only runs on Claude Code. Each provider translates these five
 * words into whatever its own agent calls them.
 *
 * Adding a capability means adding it here and teaching every provider what it
 * means. That is deliberately a bigger decision than adding a provider.
 */
export const CAPABILITIES = ["read", "search", "inspect", "execute", "write"] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * The two that can change the user's code, and the reason this file exists.
 *
 * `execute` is here because running commands is writing: `echo x > file` and
 * `sed -i` change your project exactly as much as an editor does. Counting only
 * the obvious file-writing tools is how a pipeline ends up with five
 * "read-only" phases that can all rewrite your repository.
 *
 * `inspect` is the answer to what those phases actually needed commands for —
 * reading git history, grepping, listing — and a provider may only offer it if
 * it can hold the command list to those. One that cannot simply does not grant
 * it.
 */
export const WRITING_CAPABILITIES = new Set<Capability>(["execute", "write"]);

/** What each word means, printed when someone declares one that does not exist. */
export const CAPABILITY_HELP: Record<Capability, string> = {
  read: "open files in the project",
  search: "find files and text across the project",
  inspect: "run read-only commands (git history, grep, listing)",
  execute: "run any command — CHANGES YOUR CODE",
  write: "create and modify files — CHANGES YOUR CODE",
};

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

export function changesCode(capabilities: Capability[]): boolean {
  return capabilities.some((capability) => WRITING_CAPABILITIES.has(capability));
}

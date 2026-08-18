import fs from "node:fs";
import path from "node:path";

/**
 * The walls around a phase's shell, expressed as Claude Code settings.
 *
 * The permission rules decide which *commands* a phase may run. This decides
 * what those commands can reach once they are running, which is a different
 * question and the one that matters when something goes wrong: a phase talked
 * into running a plausible-looking command should still not be able to send
 * your code anywhere or read your keys.
 *
 * Every rule here was checked by running it, not by reading the documentation.
 */

/**
 * No phase in this pipeline has any business on the network.
 *
 * An empty allowlist is the whole point of the sandbox for a tool like this:
 * it is the difference between "a phase was tricked into running curl" being a
 * bad afternoon and being a breach. Verified: with this set, `curl https://…`
 * fails; without it, the same command returns 200.
 */
const NO_NETWORK = { allowedDomains: [] };

/**
 * Places a shell command has no reason to read, and every reason to want.
 *
 * These are read denials rather than a project fence: the `inspect` capability
 * grants `cat`, `ls` and `grep`, and those say nothing about *where*. Without
 * this list a phase described as read-only could read `~/.ssh/id_rsa` and copy
 * it into an artifact. Verified: `cat` on a denied path returns "Operation not
 * permitted".
 */
const SECRETS = [
  "~/.ssh",
  "~/.aws",
  "~/.gnupg",
  "~/.kube",
  "~/.netrc",
  "~/.npmrc",
  "~/.pypirc",
  "~/.docker/config.json",
  "~/.config/gh",
  "~/.config/gcloud",
  "~/.claude/.credentials.json",
  "~/Library/Application Support/Claude",
];

/**
 * Places a phase must not be able to change, whatever it was asked to do.
 *
 * Not a fence around your project — for the writing phase, `denyWrite` wins
 * over `allowWrite`, so naming a parent directory here would lock the project
 * itself as well (verified the hard way: it blocked writes inside the working
 * directory too). These are the paths where a write is never part of a coding
 * task and always the start of something else: credentials, shell startup,
 * login items.
 */
const NEVER_WRITE = [
  ...SECRETS,
  "~/.zshrc",
  "~/.zprofile",
  "~/.bashrc",
  "~/.bash_profile",
  "~/.profile",
  "~/.gitconfig",
  "~/Library/LaunchAgents",
  "~/.config/systemd",
];

/**
 * The settings handed to one phase.
 *
 * `failIfUnavailable` is the uncomfortable one: on a machine where the sandbox
 * cannot start, the run stops instead of quietly continuing without it. This
 * project's whole claim is a boundary, and a boundary that silently turns
 * itself off is worse than no boundary, because you would still trust it.
 *
 * `allowUnsandboxedCommands: false` closes the other door — without it the
 * agent can ask for a command to be run outside the sandbox, which would make
 * every rule above a suggestion.
 *
 * `autoAllowBashIfSandboxed: false` is the one that took a run to find.
 * It defaults to *true*, which means turning the sandbox on also stops Claude
 * Code from checking the per-command permission rules: being walled in is
 * treated as reason enough to let any command through. So the very setting
 * added to make the read-only phases safer was what handed them a full shell —
 * verified by running `echo x > file` in a phase allowed only `ls` and `cat`,
 * which succeeded with the sandbox on and was refused with it off. Off, a
 * command outside the list needs a permission prompt, and in `--print` mode a
 * prompt is a failed tool call, which is what turns the list into a wall.
 */
export function sandboxSettings(canWrite: boolean, projectDir: string): string {
  return JSON.stringify({
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: false,
      network: NO_NETWORK,
      filesystem: {
        denyRead: SECRETS,
        denyWrite: canWrite ? NEVER_WRITE : [...NEVER_WRITE, realPath(projectDir)],
      },
    },
  });
}

/**
 * The project itself, denied to every phase that is not the one allowed to
 * write. The permission rules already say a read-only phase may only run
 * commands that read; this says it a second time, in the one place a mistaken
 * rule cannot argue with — the filesystem. Two locks rather than one, because
 * the first lock turned out to have a default that opened it.
 *
 * Resolved through any symlinks first: the sandbox matches real paths, and on
 * macOS a project under `/tmp` is really under `/private/tmp`, so a fence
 * written the short way would quietly cover nothing.
 */
function realPath(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

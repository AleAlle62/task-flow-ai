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
 * Not a fence around your project — `denyWrite` wins over `allowWrite`, so
 * naming a parent directory here would lock the project itself as well
 * (verified the hard way: it blocked writes inside the working directory too).
 * These are the paths where a write is never part of a coding task and always
 * the start of something else: credentials, shell startup, login items.
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
 */
export function sandboxSettings(): string {
  return JSON.stringify({
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      network: NO_NETWORK,
      filesystem: {
        denyRead: SECRETS,
        denyWrite: NEVER_WRITE,
      },
    },
  });
}

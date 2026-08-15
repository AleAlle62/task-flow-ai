import { ClaudeCliProvider } from "./claude-cli.js";
import { ProviderError, type Provider } from "./types.js";

/**
 * Every provider the tool knows about.
 *
 * Deliberately not auto-discovered: a list you can read is how someone finds
 * out what actually works, and the project's rule is that nothing appears here
 * before it has been run for real.
 */
const PROVIDERS: Record<string, () => Provider> = {
  "claude-cli": () => new ClaudeCliProvider(),
};

export function getProvider(id: string): Provider {
  const create = PROVIDERS[id];

  if (!create) {
    throw new ProviderError(
      `unknown provider "${id}". Available: ${providerNames().join(", ")}`,
    );
  }

  return create();
}

export function providerNames(): string[] {
  return Object.keys(PROVIDERS);
}

/**
 * No provider is privileged. When only one is installed it is the obvious
 * choice and the user is not asked; as soon as there are two, picking one for
 * them would be us deciding which agent they run.
 */
export function resolveProvider(requested?: string): Provider {
  if (requested) return getProvider(requested);

  const names = providerNames();

  if (names.length === 1) return getProvider(names[0] as string);

  throw new ProviderError(
    `more than one provider is available, so you have to choose one.\n` +
      `Use --provider with one of: ${names.join(", ")}`,
  );
}

export type { Enforcement, PhaseRequest, PhaseResult, Provider } from "./types.js";
export { ProviderError } from "./types.js";

import { ClaudeCliProvider } from "./claude-cli.js";
import { ProviderError, type Provider } from "./types.js";

/**
 * Every provider the tool knows about.
 *
 * Deliberately not auto-discovered: a list you can read is how someone finds
 * out what actually works, and the project's rule is that nothing is announced
 * here before it has been run for real.
 */
const PROVIDERS: Record<string, () => Provider> = {
  "claude-cli": () => new ClaudeCliProvider(),
};

export const DEFAULT_PROVIDER = "claude-cli";

export function getProvider(id: string): Provider {
  const create = PROVIDERS[id];

  if (!create) {
    throw new ProviderError(
      `unknown provider "${id}". Available: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }

  return create();
}

export function providerNames(): string[] {
  return Object.keys(PROVIDERS);
}

export type { PhaseRequest, PhaseResult, Provider } from "./types.js";
export { ProviderError } from "./types.js";

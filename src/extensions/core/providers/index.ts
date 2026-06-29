import { anthropicProvider } from "./anthropic.ts";
import { githubCopilotProvider } from "./github-copilot.ts";
import { opencodeProvider } from "./opencode.ts";
import { openAiCodexProvider } from "./openai-codex.ts";
import { openRouterProvider } from "./openrouter.ts";
import type { SubscriptionProviderDefinition, SubscriptionProviderId } from "./types.ts";

const DEFAULT_PROVIDERS: SubscriptionProviderDefinition[] = [
  openAiCodexProvider,
  githubCopilotProvider,
  anthropicProvider,
  openRouterProvider,
  opencodeProvider,
];

export class SubscriptionProviderRegistry {
  private readonly providers: SubscriptionProviderDefinition[];
  private readonly enabledProviderIds: Set<SubscriptionProviderId>;

  constructor(
    providers: SubscriptionProviderDefinition[],
    enabledProviderIds: Iterable<SubscriptionProviderId>,
  ) {
    this.providers = [...providers];
    this.enabledProviderIds = new Set(enabledProviderIds);
  }

  getAllProviders(): SubscriptionProviderDefinition[] {
    return [...this.providers];
  }

  getEnabledProviders(): SubscriptionProviderDefinition[] {
    return this.providers.filter((provider) => this.enabledProviderIds.has(provider.id));
  }

  isEnabled(providerId: SubscriptionProviderId): boolean {
    return this.enabledProviderIds.has(providerId);
  }

  setEnabledProviders(providerIds: Iterable<SubscriptionProviderId>): void {
    this.enabledProviderIds.clear();
    for (const providerId of providerIds) {
      if (this.providers.some((provider) => provider.id === providerId)) {
        this.enabledProviderIds.add(providerId);
      }
    }
  }
}

export function getDefaultEnabledProviderIds(
  providers: SubscriptionProviderDefinition[] = DEFAULT_PROVIDERS,
): SubscriptionProviderId[] {
  return providers.filter((provider) => provider.enabledByDefault).map((provider) => provider.id);
}

export function createDefaultSubscriptionProviderRegistry(
  enabledProviderIds: Iterable<SubscriptionProviderId> = getDefaultEnabledProviderIds(),
): SubscriptionProviderRegistry {
  return new SubscriptionProviderRegistry(DEFAULT_PROVIDERS, enabledProviderIds);
}

export { DEFAULT_PROVIDERS as subscriptionProviders };
export type { SubscriptionProviderDefinition, SubscriptionProviderId } from "./types.ts";

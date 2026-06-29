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

function parseProviderIds(value: string | undefined): SubscriptionProviderId[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const knownIds = new Set<SubscriptionProviderId>(DEFAULT_PROVIDERS.map((provider) => provider.id));
  const parsedIds = value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is SubscriptionProviderId => knownIds.has(part as SubscriptionProviderId));

  return parsedIds.length > 0 ? parsedIds : undefined;
}

function getDefaultEnabledProviderIds(
  providers: SubscriptionProviderDefinition[],
  envProviders: string | undefined,
): SubscriptionProviderId[] {
  const explicitProviderIds = parseProviderIds(envProviders);
  if (explicitProviderIds) {
    return explicitProviderIds;
  }

  return providers.filter((provider) => provider.enabledByDefault).map((provider) => provider.id);
}

export function createDefaultSubscriptionProviderRegistry(
  envProviders: string | undefined = process.env.PI_SUBSCRIPTION_METER_PROVIDERS,
): SubscriptionProviderRegistry {
  return new SubscriptionProviderRegistry(
    DEFAULT_PROVIDERS,
    getDefaultEnabledProviderIds(DEFAULT_PROVIDERS, envProviders),
  );
}

export { DEFAULT_PROVIDERS as subscriptionProviders };
export type { SubscriptionProviderDefinition, SubscriptionProviderId } from "./types.ts";

export type SubscriptionProviderId =
  | "openai-codex"
  | "github-copilot"
  | "anthropic"
  | "openrouter"
  | "opencode";

export type SubscriptionProviderStability = "official" | "unofficial" | "mixed" | "unknown";

export interface SubscriptionProviderDefinition {
  id: SubscriptionProviderId;
  label: string;
  shortLabel: string;
  enabledByDefault: boolean;
  implementationStatus: "scaffold";
  description: string;
  authHint: string;
  usageHint: string;
  stability: SubscriptionProviderStability;
  notes: string[];
}

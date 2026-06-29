import type { SubscriptionProviderDefinition } from "./types.ts";

export const anthropicProvider: SubscriptionProviderDefinition = {
  id: "anthropic",
  label: "Anthropic",
  shortLabel: "Anthropic",
  enabledByDefault: true,
  implementationStatus: "scaffold",
  description: "Scaffold for Anthropic admin usage and future Claude subscription-style limit windows.",
  authHint: "Prefer Pi-managed Anthropic auth; future admin analytics may use ANTHROPIC_ADMIN_KEY while user subscription views may use OAuth bearer tokens.",
  usageHint: "Mixed surface: official admin usage APIs for org analytics and unofficial Claude product endpoints for personal subscription windows.",
  stability: "mixed",
  notes: [
    "Admin analytics and personal subscription meters should remain separate concepts in the UI.",
    "User subscription endpoints must be labeled as product-specific and potentially unstable.",
  ],
};

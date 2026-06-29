import type { SubscriptionProviderDefinition } from "./types.ts";

export const openRouterProvider: SubscriptionProviderDefinition = {
  id: "openrouter",
  label: "OpenRouter",
  shortLabel: "OpenRouter",
  enabledByDefault: true,
  implementationStatus: "scaffold",
  description: "Scaffold for OpenRouter key budget, daily/weekly/monthly usage, and credits views.",
  authHint: "Prefer Pi-managed OpenRouter auth or OPENROUTER_API_KEY.",
  usageHint: "Official API surface is available for /api/v1/key and /api/v1/credits, making this a strong early implementation target.",
  stability: "official",
  notes: [
    "OpenRouter is the cleanest first provider to implement against.",
    "Budget and credit displays can likely share the same provider tab later.",
  ],
};

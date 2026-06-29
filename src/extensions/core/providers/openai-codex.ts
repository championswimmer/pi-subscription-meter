import type { SubscriptionProviderDefinition } from "./types.ts";

export const openAiCodexProvider: SubscriptionProviderDefinition = {
  id: "openai-codex",
  label: "OpenAI Codex",
  shortLabel: "OpenAI/Codex",
  enabledByDefault: true,
  implementationStatus: "scaffold",
  description: "Scaffold for end-user ChatGPT/Codex subscription meters and future OpenAI admin usage views.",
  authHint: "Prefer Pi-managed OpenAI auth or a ChatGPT/Codex bearer token; future admin usage support may use OPENAI_ADMIN_KEY.",
  usageHint: "Likely mixed: official OpenAI admin endpoints for org usage, unofficial ChatGPT/Codex product endpoints for personal subscription windows.",
  stability: "mixed",
  notes: [
    "Start as a placeholder only; no fetching is implemented yet.",
    "Keep personal subscription counters clearly labeled as unofficial when implemented.",
  ],
};

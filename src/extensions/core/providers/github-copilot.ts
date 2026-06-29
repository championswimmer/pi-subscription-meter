import type { SubscriptionProviderDefinition } from "./types.ts";

export const githubCopilotProvider: SubscriptionProviderDefinition = {
  id: "github-copilot",
  label: "GitHub Copilot",
  shortLabel: "Copilot",
  enabledByDefault: true,
  implementationStatus: "scaffold",
  description: "Scaffold for GitHub Copilot subscription and quota views across personal and org/enterprise contexts.",
  authHint: "Prefer Pi-managed GitHub auth or GITHUB_TOKEN; org and enterprise billing views will require elevated GitHub scopes.",
  usageHint: "Mixed surface: official org/enterprise billing APIs plus unofficial personal Copilot usage endpoints.",
  stability: "mixed",
  notes: [
    "Org and enterprise billing APIs are the safer first implementation target.",
    "Personal Copilot counters should be explicitly marked as internal/unofficial if added later.",
  ],
};

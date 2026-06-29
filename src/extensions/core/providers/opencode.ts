import type { SubscriptionProviderDefinition } from "./types.ts";

export const opencodeProvider: SubscriptionProviderDefinition = {
  id: "opencode",
  label: "OpenCode",
  shortLabel: "OpenCode",
  enabledByDefault: false,
  implementationStatus: "scaffold",
  description: "Scaffold for OpenCode Go / Zen subscription limits and future usage integration if a stable API is confirmed.",
  authHint: "Prefer Pi-managed auth or existing local OpenCode auth state when supported; avoid assuming a stable public usage token flow yet.",
  usageHint: "Current safe assumption is limits-only or console-backed information until a documented usage API is verified.",
  stability: "unknown",
  notes: [
    "Disabled by default because a stable programmatic usage API has not been confirmed.",
    "This tab is still supported by the registry and can be enabled later without changing the dialog framework.",
  ],
  usageWindows: [
    { label: "5h", statusLabel: "pending", notches: [25, 50, 75] },
    { label: "Weekly", statusLabel: "pending", notches: [50, 75] },
    { label: "Monthly", statusLabel: "pending", notches: [50, 75, 90] },
  ],
};

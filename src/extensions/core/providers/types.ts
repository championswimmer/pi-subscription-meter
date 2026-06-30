export type SubscriptionProviderId =
  | "openai-codex"
  | "github-copilot"
  | "anthropic"
  | "openrouter"
  | "kilocode"
  | "opencode";

export type SubscriptionProviderStability = "official" | "unofficial" | "mixed" | "unknown";
export type SubscriptionProviderImplementationStatus = "scaffold" | "implemented";
export type SubscriptionProviderRuntimeLoadState = "loading" | "ready" | "error";

export interface SubscriptionUsageWindowDefinition {
  label: string;
  usedPercent?: number;
  statusLabel?: string;
  detailLabel?: string;
  resetAt?: Date;
  notches?: number[];
  pacePercent?: number;
}

export interface SubscriptionProviderRuntimeState {
  state: SubscriptionProviderRuntimeLoadState;
  implementationStatus?: SubscriptionProviderImplementationStatus;
  statusLine?: string;
  description?: string;
  authHint?: string;
  usageHint?: string;
  notes?: string[];
  usageWindows?: SubscriptionUsageWindowDefinition[];
  errorMessage?: string;
  lastUpdatedAt?: Date;
}

export interface SubscriptionProviderDefinition {
  id: SubscriptionProviderId;
  label: string;
  shortLabel: string;
  enabledByDefault: boolean;
  implementationStatus: SubscriptionProviderImplementationStatus;
  description: string;
  authHint: string;
  usageHint: string;
  stability: SubscriptionProviderStability;
  notes: string[];
  usageWindows: SubscriptionUsageWindowDefinition[];
  loadRuntimeState?: () => Promise<SubscriptionProviderRuntimeState>;
}

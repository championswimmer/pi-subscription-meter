import { AuthStorage, type AuthStatus } from "@earendil-works/pi-coding-agent";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "./types.ts";

const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";
const OPENROUTER_TIMEOUT_MS = 15_000;

interface OpenRouterKeyResponse {
  data?: {
    byok_usage?: number;
    byok_usage_daily?: number;
    byok_usage_monthly?: number;
    byok_usage_weekly?: number;
    creator_user_id?: string;
    expires_at?: string;
    include_byok_in_limit?: boolean;
    is_free_tier?: boolean;
    is_management_key?: boolean;
    is_provisioning_key?: boolean;
    label?: string;
    limit?: number;
    limit_remaining?: number;
    limit_reset?: string;
    usage?: number;
    usage_daily?: number;
    usage_monthly?: number;
    usage_weekly?: number;
  };
}

interface OpenRouterCreditsResponse {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function safePercent(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return clampPercent((used / limit) * 100);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUtcDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value);
}

function parseDateish(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
}

function nextUtcMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 0, 0, 0));
}

function nextUtcMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

function authSourceLabel(authStatus: AuthStatus): string | undefined {
  if (authStatus.source === "environment") {
    return authStatus.label ?? "environment";
  }

  if (authStatus.source === "stored") {
    return "Pi auth.json";
  }

  if (authStatus.source === "runtime") {
    return "runtime key";
  }

  if (authStatus.source === "fallback") {
    return "fallback key";
  }

  return undefined;
}

async function fetchOpenRouterJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || response.statusText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchOpenRouterKeyData(accessToken: string): Promise<OpenRouterKeyResponse> {
  return fetchOpenRouterJson<OpenRouterKeyResponse>(OPENROUTER_KEY_URL, accessToken);
}

async function fetchOpenRouterCreditsData(accessToken: string): Promise<OpenRouterCreditsResponse> {
  return fetchOpenRouterJson<OpenRouterCreditsResponse>(OPENROUTER_CREDITS_URL, accessToken);
}

function buildOpenRouterUsageWindows(
  keyData: NonNullable<OpenRouterKeyResponse["data"]> | undefined,
  creditsData: NonNullable<OpenRouterCreditsResponse["data"]> | undefined,
): SubscriptionUsageWindowDefinition[] {
  const windows: SubscriptionUsageWindowDefinition[] = [];
  const totalCredits = parseNumber(creditsData?.total_credits);
  const totalUsage = parseNumber(creditsData?.total_usage) ?? 0;

  if (totalCredits != null && totalCredits > 0) {
    const remainingCredits = Math.max(0, totalCredits - totalUsage);
    windows.push({
      label: "Credits Remaining",
      statusLabel: formatCurrency(remainingCredits),
      detailLabel: `${formatCurrency(totalUsage)}/${formatCurrency(totalCredits)}`,
      notches: [50, 75, 90],
    });
  }

  if (!keyData) {
    return windows;
  }

  const limit = parseNumber(keyData.limit);
  const limitRemaining = parseNumber(keyData.limit_remaining);
  const usageDaily = parseNumber(keyData.usage_daily) ?? 0;
  const usageWeekly = parseNumber(keyData.usage_weekly) ?? 0;
  const usageMonthly = parseNumber(keyData.usage_monthly) ?? parseNumber(keyData.usage) ?? 0;

  if (limit != null && limit > 0) {
    const remaining = limitRemaining ?? Math.max(0, limit - usageMonthly);
    const resetAt = parseDateish(keyData.limit_reset) ?? nextUtcMonthStart();

    windows.push({
      label: "Monthly Budget",
      usedPercent: safePercent(usageMonthly, limit),
      detailLabel: `${formatCurrency(usageMonthly)}/${formatCurrency(limit)} • ${formatCurrency(remaining)} left`,
      resetAt,
      notches: [50, 75, 90],
    });
  } else if (limitRemaining != null && totalCredits == null) {
    windows.push({
      label: "Key Balance",
      statusLabel: formatCurrency(limitRemaining),
      notches: [50, 75, 90],
    });
  }

  const dailyResetAt = nextUtcMidnight();
  windows.push({
    label: "Daily",
    statusLabel: formatCurrency(usageDaily),
    resetAt: dailyResetAt,
    notches: [50],
  });

  const weeklyResetAt = nextUtcMonday();
  windows.push({
    label: "Weekly",
    statusLabel: formatCurrency(usageWeekly),
    resetAt: weeklyResetAt,
    notches: [50, 75],
  });

  const monthlyResetAt = nextUtcMonthStart();
  windows.push({
    label: "Monthly",
    statusLabel: formatCurrency(usageMonthly),
    resetAt: monthlyResetAt,
    notches: [50, 75, 90],
  });

  return windows;
}

export async function loadOpenRouterRuntimeState(): Promise<SubscriptionProviderRuntimeState> {
  const authStorage = AuthStorage.create();
  const authStatus = authStorage.getAuthStatus("openrouter");
  const apiKey = await authStorage.getApiKey("openrouter");

  if (!apiKey) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "auth missing",
      errorMessage: "No OpenRouter API key found. Configure OPENROUTER_API_KEY or store an OpenRouter key with /login.",
      authHint: "This provider uses the official OpenRouter GET /api/v1/key endpoint.",
      usageWindows: [],
    };
  }

  try {
    const [keyResult, creditsResult] = await Promise.allSettled([
      fetchOpenRouterKeyData(apiKey),
      fetchOpenRouterCreditsData(apiKey),
    ]);

    const keyData = keyResult.status === "fulfilled" ? keyResult.value.data : undefined;
    const creditsData = creditsResult.status === "fulfilled" ? creditsResult.value.data : undefined;

    if (!keyData && !creditsData) {
      const keyError = keyResult.status === "rejected" ? keyResult.reason : undefined;
      const creditsError = creditsResult.status === "rejected" ? creditsResult.reason : undefined;
      throw keyError instanceof Error
        ? keyError
        : creditsError instanceof Error
          ? creditsError
          : new Error("OpenRouter returned no usable usage data.");
    }

    const totalCredits = parseNumber(creditsData?.total_credits);
    const totalUsage = parseNumber(creditsData?.total_usage) ?? 0;
    const remainingCredits = totalCredits != null ? Math.max(0, totalCredits - totalUsage) : undefined;
    const remainingKeyBalance = parseNumber(keyData?.limit_remaining);
    const notes: string[] = [];

    if (keyData?.label) {
      notes.push(`Key label: ${keyData.label}`);
    }

    if (keyData?.is_free_tier) {
      notes.push("Free-tier key");
    }

    if (keyData?.expires_at) {
      const expiresAt = new Date(keyData.expires_at);
      if (!Number.isNaN(expiresAt.getTime())) {
        notes.push(`Key expires ${formatUtcDate(expiresAt)} UTC`);
      }
    }

    const byokMonthly = parseNumber(keyData?.byok_usage_monthly);
    if (byokMonthly != null && byokMonthly > 0) {
      notes.push(`BYOK monthly usage: ${formatCurrency(byokMonthly)}`);
      if (keyData?.include_byok_in_limit === false) {
        notes.push("BYOK usage is excluded from the key budget limit");
      }
    }

    if (creditsData) {
      notes.push("Account credits loaded from GET /api/v1/credits");
    }

    const sourceLabel = authSourceLabel(authStatus);

    return {
      state: "ready",
      implementationStatus: "implemented",
      statusLine: remainingCredits != null
        ? `${formatCurrency(remainingCredits)} credits remaining`
        : remainingKeyBalance != null
          ? `${formatCurrency(remainingKeyBalance)} remaining`
          : "live key data",
      description: "Live data from OpenRouter’s official GET /api/v1/key and GET /api/v1/credits endpoints.",
      authHint: sourceLabel ? `Auth source: ${sourceLabel}` : undefined,
      usageHint: "Budget, credits, and daily/weekly/monthly usage are fetched from the active OpenRouter key when available.",
      notes,
      usageWindows: buildOpenRouterUsageWindows(keyData, creditsData),
      lastUpdatedAt: new Date(),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "fetch failed",
      errorMessage: `Failed to load OpenRouter usage: ${message}`,
      authHint: "Verify the OpenRouter key and network access, then press r to retry.",
      usageWindows: [],
    };
  }
}

export const openRouterProvider: SubscriptionProviderDefinition = {
  id: "openrouter",
  label: "OpenRouter",
  shortLabel: "OpenRouter",
  enabledByDefault: true,
  implementationStatus: "implemented",
  description: "Official OpenRouter key budget and usage view.",
  authHint: "Prefer Pi-managed OpenRouter auth or OPENROUTER_API_KEY.",
  usageHint: "Uses the official GET /api/v1/key endpoint for live key budget and usage data.",
  stability: "official",
  notes: [
    "OpenRouter is the cleanest first provider to implement against.",
    "Daily, weekly, and monthly rows are tracking windows reported by the active key.",
  ],
  usageWindows: [
    { label: "Monthly Budget", statusLabel: "loading…", notches: [50, 75, 90] },
    { label: "Daily", statusLabel: "loading…", notches: [50] },
    { label: "Weekly", statusLabel: "loading…", notches: [50, 75] },
    { label: "Monthly", statusLabel: "loading…", notches: [50, 75, 90] },
  ],
  loadRuntimeState: loadOpenRouterRuntimeState,
};

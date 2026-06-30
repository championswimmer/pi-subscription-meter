import { AuthStorage, type AuthStatus } from "@earendil-works/pi-coding-agent";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "./types.ts";

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const ANTHROPIC_TIMEOUT_MS = 20_000;
const FIVE_HOUR_SECONDS = 5 * 60 * 60;
const SEVEN_DAY_SECONDS = 7 * 24 * 60 * 60;

interface AnthropicUsageEntry {
  utilization?: number | string;
  resets_at?: string | number;
}

interface AnthropicExtraUsage {
  is_enabled?: boolean;
  monthly_limit?: number | string;
  used_credits?: number | string;
  currency?: string;
  utilization?: number | string;
}

interface AnthropicUsageResponse {
  five_hour?: AnthropicUsageEntry;
  seven_day?: AnthropicUsageEntry;
  seven_day_sonnet?: AnthropicUsageEntry;
  seven_day_omelette?: AnthropicUsageEntry;
  seven_day_opus?: AnthropicUsageEntry;
  extra_usage?: AnthropicExtraUsage;
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

function formatPercent(percent: number | undefined): string {
  return `${Math.round(percent ?? 0)}%`;
}

function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}


function authSourceLabel(authStatus: AuthStatus): string | undefined {
  if (authStatus.source === "environment") {
    return authStatus.label ?? "environment";
  }

  if (authStatus.source === "stored") {
    return "Pi auth.json";
  }

  if (authStatus.source === "runtime") {
    return "runtime token";
  }

  if (authStatus.source === "fallback") {
    return "fallback token";
  }

  return undefined;
}

function parseDateish(value: unknown): Date | undefined {
  const numeric = parseNumber(value);
  if (numeric != null) {
    const millis = numeric < 1e12 ? numeric * 1000 : numeric;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

function nextUtcMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

function currentUtcMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
}

function createAnthropicPercentWindow(
  label: string,
  entry: AnthropicUsageEntry | undefined,
  windowSeconds: number,
): SubscriptionUsageWindowDefinition | undefined {
  const usedPercent = clampPercent(parseNumber(entry?.utilization) ?? 0);
  if (!entry || parseNumber(entry.utilization) == null) {
    return undefined;
  }

  const resetAt = parseDateish(entry.resets_at);
  let detailLabel: string | undefined;
  let pacePercent: number | undefined;

  if (resetAt) {
    const remainingSeconds = Math.max(0, Math.round((resetAt.getTime() - Date.now()) / 1000));
    const elapsedSeconds = Math.max(0, windowSeconds - remainingSeconds);
    pacePercent = clampPercent((elapsedSeconds / windowSeconds) * 100);
    detailLabel = `${formatPercent(pacePercent)} elapsed`;
  }

  return {
    label,
    usedPercent,
    detailLabel,
    resetAt,
    pacePercent,
    notches: [25, 50, 75],
  };
}

function createAnthropicExtraWindow(extra: AnthropicExtraUsage | undefined): SubscriptionUsageWindowDefinition | undefined {
  if (!extra?.is_enabled) {
    return undefined;
  }

  const monthlyLimitCents = parseNumber(extra.monthly_limit);
  if (monthlyLimitCents == null || monthlyLimitCents <= 0) {
    return undefined;
  }

  const usedCreditsCents = parseNumber(extra.used_credits) ?? 0;
  const currency = typeof extra.currency === "string" && extra.currency.length > 0 ? extra.currency : "USD";
  const limitValue = monthlyLimitCents / 100;
  const usedValue = usedCreditsCents / 100;
  const usedPercent = clampPercent(parseNumber(extra.utilization) ?? safePercent(usedValue, limitValue));
  const resetAt = nextUtcMonthStart();
  const startAt = currentUtcMonthStart();
  const totalSeconds = Math.max(1, Math.round((resetAt.getTime() - startAt.getTime()) / 1000));
  const remainingSeconds = Math.max(0, Math.round((resetAt.getTime() - Date.now()) / 1000));
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
  const pacePercent = clampPercent((elapsedSeconds / totalSeconds) * 100);

  return {
    label: `Extra (${currency})`,
    usedPercent,
    detailLabel: [
      `${formatCurrency(usedValue, currency)}/${formatCurrency(limitValue, currency)}`,
      `${formatPercent(pacePercent)} elapsed`,
    ].join(" • "),
    resetAt,
    pacePercent,
    notches: [50, 75, 90],
  };
}

async function fetchAnthropicUsage(accessToken: string): Promise<AnthropicUsageResponse> {
  const response = await fetch(ANTHROPIC_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "anthropic-beta": "oauth-2025-04-20",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || response.statusText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<AnthropicUsageResponse>;
}

function parseAnthropicWindows(response: AnthropicUsageResponse): SubscriptionUsageWindowDefinition[] {
  const windows: SubscriptionUsageWindowDefinition[] = [];

  const baseWindows = [
    createAnthropicPercentWindow("5h", response.five_hour, FIVE_HOUR_SECONDS),
    createAnthropicPercentWindow("7d", response.seven_day, SEVEN_DAY_SECONDS),
    createAnthropicPercentWindow("7d Sonnet", response.seven_day_sonnet, SEVEN_DAY_SECONDS),
    createAnthropicPercentWindow("7d Opus", response.seven_day_omelette, SEVEN_DAY_SECONDS),
    createAnthropicPercentWindow("7d Opus (legacy)", response.seven_day_opus, SEVEN_DAY_SECONDS),
  ].filter((window): window is SubscriptionUsageWindowDefinition => !!window);

  windows.push(...baseWindows);

  const extraWindow = createAnthropicExtraWindow(response.extra_usage);
  if (extraWindow) {
    windows.push(extraWindow);
  }

  return windows;
}

function buildStatusLine(windows: SubscriptionUsageWindowDefinition[]): string {
  const shortWindows = ["5h", "7d"]
    .map((label) => windows.find((window) => window.label === label))
    .filter((window): window is SubscriptionUsageWindowDefinition => !!window)
    .map((window) => `${window.label} ${formatPercent(window.usedPercent)} used`);

  if (shortWindows.length > 0) {
    return shortWindows.join(" • ");
  }

  const extra = windows.find((window) => window.label.startsWith("Extra"));
  if (extra?.usedPercent != null) {
    return `${extra.label} ${formatPercent(extra.usedPercent)} used`;
  }

  return "live usage data";
}

export async function loadAnthropicRuntimeState(): Promise<SubscriptionProviderRuntimeState> {
  const authStorage = AuthStorage.create();
  const authStatus = authStorage.getAuthStatus("anthropic");
  const accessToken = await authStorage.getApiKey("anthropic");

  if (!accessToken) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "auth missing",
      errorMessage: "No Anthropic credential found. Log in to Claude with /login first to use the personal subscription-style meter.",
      authHint: "This provider uses Anthropic’s unofficial Claude product usage endpoint.",
      usageWindows: [],
    };
  }

  try {
    const response = await fetchAnthropicUsage(accessToken);
    const usageWindows = parseAnthropicWindows(response);

    if (usageWindows.length === 0) {
      return {
        state: "error",
        implementationStatus: "implemented",
        statusLine: "schema mismatch",
        errorMessage: "Anthropic returned usage data, but no recognizable 5h/7d usage windows could be parsed from the current response schema.",
        authHint: "This provider depends on an unofficial Claude product usage endpoint that may change without notice.",
        usageWindows: [],
      };
    }

    const notes = [
      "Uses the unofficial Claude GET /api/oauth/usage endpoint.",
      "The progress-bar notch marks the current point in the active time window.",
      "Anthropic currently exposes percentage-based usage windows here, not absolute message/token limits.",
    ];

    if (usageWindows.some((window) => window.label.startsWith("7d "))) {
      notes.push("Model-specific weekly windows are shown when Claude returns them.");
    }

    if (usageWindows.some((window) => window.label.startsWith("Extra"))) {
      notes.push("Extra usage is shown as a monthly currency budget when enabled on the account.");
    }

    return {
      state: "ready",
      implementationStatus: "implemented",
      statusLine: buildStatusLine(usageWindows),
      description: "Live personal Claude usage windows for the current account.",
      authHint: authSourceLabel(authStatus) ? `token: ${authSourceLabel(authStatus)}` : undefined,
      usageHint: "Shows the current 5-hour and 7-day Claude usage windows returned by the Claude product API.",
      notes,
      usageWindows,
      lastUpdatedAt: new Date(),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const invalidBearer = message.includes("Invalid bearer token");
    const apiKeyMismatch = invalidBearer && authStatus.source === "environment" && authStatus.label === "ANTHROPIC_API_KEY";

    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "fetch failed",
      errorMessage: apiKeyMismatch
        ? "The configured Anthropic credential appears to be an API key (ANTHROPIC_API_KEY). Claude personal usage windows require a Claude OAuth token from /login."
        : `Failed to load Anthropic usage: ${message}`,
      authHint: apiKeyMismatch
        ? "Official Anthropic API keys are valid for admin/API usage, but this personal meter needs Claude product auth."
        : "Verify the Anthropic/Claude login is still valid, then press r to retry.",
      usageWindows: [],
    };
  }
}

export const anthropicProvider: SubscriptionProviderDefinition = {
  id: "anthropic",
  label: "Anthropic",
  shortLabel: "Anthropic",
  enabledByDefault: true,
  implementationStatus: "implemented",
  description: "Live Claude personal usage windows for the current account.",
  authHint: "Uses Pi-managed Claude auth. A normal ANTHROPIC_API_KEY is not enough for the personal subscription-style meter.",
  usageHint: "Uses the unofficial Claude product usage endpoint for personal 5h / 7d windows.",
  stability: "mixed",
  notes: [
    "This provider relies on an unofficial Claude product usage endpoint.",
    "The current implementation focuses on personal 5h and 7d windows first.",
  ],
  usageWindows: [
    { label: "5h", statusLabel: "loading…", notches: [25, 50, 75] },
    { label: "7d", statusLabel: "loading…", notches: [25, 50, 75] },
    { label: "7d Sonnet", statusLabel: "loading…", notches: [25, 50, 75] },
    { label: "Extra", statusLabel: "loading…", notches: [50, 75, 90] },
  ],
  loadRuntimeState: loadAnthropicRuntimeState,
};

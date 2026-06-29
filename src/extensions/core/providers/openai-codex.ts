import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AuthStorage, type AuthStatus } from "@earendil-works/pi-coding-agent";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "./types.ts";

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_TIMEOUT_MS = 20_000;

interface CodexUsageLimitWindow {
  used_percent?: number;
  percent_left?: number;
  remaining_percent?: number;
  reset_at?: number | string;
  reset_time_ms?: number | string;
  reset_after_seconds?: number | string;
  limit_window_seconds?: number | string;
}

interface CodexUsageArrayLimit {
  type?: string;
  unit?: number | string;
  percentage?: number | string;
  nextResetTime?: number | string;
}

interface CodexUsageResponse {
  user_id?: string;
  account_id?: string;
  plan_type?: string;
  email?: string;
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: CodexUsageLimitWindow;
    secondary_window?: CodexUsageLimitWindow;
    primary?: CodexUsageLimitWindow;
    secondary?: CodexUsageLimitWindow;
    five_hour_limit?: CodexUsageLimitWindow;
    weekly_limit?: CodexUsageLimitWindow;
    five_hour?: CodexUsageLimitWindow;
    weekly?: CodexUsageLimitWindow;
  };
  rate_limits?: {
    primary_window?: CodexUsageLimitWindow;
    secondary_window?: CodexUsageLimitWindow;
    primary?: CodexUsageLimitWindow;
    secondary?: CodexUsageLimitWindow;
    five_hour_limit?: CodexUsageLimitWindow;
    weekly_limit?: CodexUsageLimitWindow;
    five_hour?: CodexUsageLimitWindow;
    weekly?: CodexUsageLimitWindow;
  };
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    overage_limit_reached?: boolean;
    balance?: number | string;
    approx_local_messages?: number | string | Array<number | string>;
    approx_cloud_messages?: number | string | Array<number | string>;
  };
  spend_control?: {
    reached?: boolean;
    individual_limit?: number | string | null;
  };
  data?: {
    limits?: CodexUsageArrayLimit[];
    level?: string;
  };
  rate_limit_reset_credits?: {
    available_count?: number | string;
  };
}

interface AccountResolution {
  accountId?: string;
  source?: string;
}

interface CodexWindowParseResult {
  sessionWindow?: SubscriptionUsageWindowDefinition;
  weeklyWindow?: SubscriptionUsageWindowDefinition;
  parseNotes: string[];
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

function usedPercentFromLimit(limit: CodexUsageLimitWindow | CodexUsageArrayLimit | undefined): number | undefined {
  const percentLeft = parseNumber((limit as CodexUsageLimitWindow | undefined)?.percent_left);
  if (percentLeft != null) {
    return clampPercent(100 - percentLeft);
  }

  const remainingPercent = parseNumber((limit as CodexUsageLimitWindow | undefined)?.remaining_percent);
  if (remainingPercent != null) {
    return clampPercent(100 - remainingPercent);
  }

  const usedPercent = parseNumber((limit as CodexUsageLimitWindow | undefined)?.used_percent);
  if (usedPercent != null) {
    return clampPercent(usedPercent);
  }

  const percentage = parseNumber((limit as CodexUsageArrayLimit | undefined)?.percentage);
  if (percentage != null) {
    return clampPercent(percentage);
  }

  return undefined;
}

function formatPercent(percent: number | undefined): string {
  return `${Math.round(percent ?? 0)}%`;
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

function resolveCodexAccountId(authStorage: AuthStorage): AccountResolution {
  const credential = authStorage.get("openai-codex") as Record<string, unknown> | undefined;
  const storedAccountId =
    typeof credential?.accountId === "string"
      ? credential.accountId
      : typeof credential?.account_id === "string"
        ? credential.account_id
        : undefined;

  if (storedAccountId) {
    return {
      accountId: storedAccountId,
      source: "Pi auth.json",
    };
  }

  try {
    const authPath = join(homedir(), ".codex", "auth.json");
    const parsed = JSON.parse(readFileSync(authPath, "utf8")) as {
      tokens?: { account_id?: string; accountId?: string };
    };
    const fallbackAccountId = parsed.tokens?.account_id ?? parsed.tokens?.accountId;
    if (fallbackAccountId) {
      return {
        accountId: fallbackAccountId,
        source: "~/.codex/auth.json",
      };
    }
  } catch {
    // ignore fallback read errors
  }

  return {};
}

function parseResetAt(limit: CodexUsageLimitWindow | CodexUsageArrayLimit | undefined): Date | undefined {
  const resetAtValue =
    (limit as CodexUsageLimitWindow | undefined)?.reset_at ??
    (limit as CodexUsageLimitWindow | undefined)?.reset_time_ms ??
    (limit as CodexUsageArrayLimit | undefined)?.nextResetTime;
  const numericReset = parseNumber(resetAtValue);

  if (numericReset != null) {
    const millis = numericReset < 1e12 ? numericReset * 1000 : numericReset;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  if (typeof resetAtValue === "string") {
    const date = new Date(resetAtValue);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const resetAfterSeconds = parseNumber((limit as CodexUsageLimitWindow | undefined)?.reset_after_seconds);
  if (resetAfterSeconds != null) {
    return new Date(Date.now() + resetAfterSeconds * 1000);
  }

  return undefined;
}

function parseWindowSeconds(limit: CodexUsageLimitWindow | CodexUsageArrayLimit | undefined, fallbackSeconds: number): number {
  return Math.max(1, parseNumber((limit as CodexUsageLimitWindow | undefined)?.limit_window_seconds) ?? fallbackSeconds);
}

function createCodexWindow(
  label: string,
  limit: CodexUsageLimitWindow | CodexUsageArrayLimit | undefined,
  fallbackSeconds: number,
): SubscriptionUsageWindowDefinition | undefined {
  const usedPercent = usedPercentFromLimit(limit);
  if (usedPercent == null) {
    return undefined;
  }

  const resetAt = parseResetAt(limit);
  const windowSeconds = parseWindowSeconds(limit, fallbackSeconds);
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
  };
}

function parseCodexLimitsArray(limits: unknown): CodexWindowParseResult {
  const parseNotes: string[] = [];
  if (!Array.isArray(limits) || limits.length === 0) {
    return { parseNotes };
  }

  const normalized = limits
    .map((limit) => (limit && typeof limit === "object" ? limit as CodexUsageArrayLimit : undefined))
    .filter((limit): limit is CodexUsageArrayLimit => !!limit);

  const sessionCandidate = normalized.find((limit) => String(limit.unit) === "3") ?? normalized[0];
  const weeklyCandidate = normalized.find((limit) => String(limit.unit) === "6") ?? normalized[1];

  if (!normalized.find((limit) => String(limit.unit) === "3")) {
    parseNotes.push("Session window inferred heuristically from the legacy limits array shape.");
  }

  if (!normalized.find((limit) => String(limit.unit) === "6")) {
    parseNotes.push("Weekly window inferred heuristically from the legacy limits array shape.");
  }

  return {
    sessionWindow: createCodexWindow("Session", sessionCandidate, 5 * 60 * 60),
    weeklyWindow: createCodexWindow("Weekly", weeklyCandidate, 7 * 24 * 60 * 60),
    parseNotes,
  };
}

function parseCodexUsageWindows(response: CodexUsageResponse): CodexWindowParseResult {
  const rateLimit = response.rate_limit ?? response.rate_limits ?? {};
  const primary = rateLimit.primary_window ?? rateLimit.primary ?? rateLimit.five_hour_limit ?? rateLimit.five_hour;
  const secondary = rateLimit.secondary_window ?? rateLimit.secondary ?? rateLimit.weekly_limit ?? rateLimit.weekly;

  const sessionWindow = createCodexWindow("Session", primary, 5 * 60 * 60);
  const weeklyWindow = createCodexWindow("Weekly", secondary, 7 * 24 * 60 * 60);

  if (sessionWindow || weeklyWindow) {
    return {
      sessionWindow,
      weeklyWindow,
      parseNotes: [],
    };
  }

  return parseCodexLimitsArray(response.data?.limits);
}

async function fetchCodexUsage(accessToken: string, accountId: string): Promise<CodexUsageResponse> {
  const response = await fetch(CODEX_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "ChatGPT-Account-Id": accountId,
      Accept: "application/json",
      Origin: "https://chatgpt.com",
      Referer: "https://chatgpt.com/",
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(CODEX_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || response.statusText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<CodexUsageResponse>;
}

function buildStatusLine(sessionWindow?: SubscriptionUsageWindowDefinition, weeklyWindow?: SubscriptionUsageWindowDefinition): string {
  const parts: string[] = [];

  if (sessionWindow?.usedPercent != null) {
    parts.push(`session ${formatPercent(sessionWindow.usedPercent)} used`);
  }

  if (weeklyWindow?.usedPercent != null) {
    parts.push(`weekly ${formatPercent(weeklyWindow.usedPercent)} used`);
  }

  return parts.join(" • ") || "live usage data";
}

export async function loadOpenAiCodexRuntimeState(): Promise<SubscriptionProviderRuntimeState> {
  const authStorage = AuthStorage.create();
  const authStatus = authStorage.getAuthStatus("openai-codex");
  const accessToken = await authStorage.getApiKey("openai-codex");
  const accountResolution = resolveCodexAccountId(authStorage);

  if (!accessToken) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "auth missing",
      errorMessage: "No OpenAI Codex bearer token found. Log in to OpenAI/Codex with /login first.",
      authHint: "This provider uses the unofficial ChatGPT/Codex usage endpoint.",
      usageWindows: [],
    };
  }

  if (!accountResolution.accountId) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "account id missing",
      errorMessage: "No ChatGPT account ID found for Codex. Re-auth with /login or restore ~/.codex/auth.json.",
      authHint: "Codex requires both a bearer token and ChatGPT-Account-Id.",
      usageWindows: [],
    };
  }

  try {
    const response = await fetchCodexUsage(accessToken, accountResolution.accountId);
    const { sessionWindow, weeklyWindow, parseNotes } = parseCodexUsageWindows(response);
    const usageWindows = [sessionWindow, weeklyWindow].filter(
      (window): window is SubscriptionUsageWindowDefinition => !!window,
    );

    if (usageWindows.length === 0) {
      return {
        state: "error",
        implementationStatus: "implemented",
        statusLine: "schema mismatch",
        errorMessage: "Codex returned usage data, but no session/weekly windows could be parsed from the current response schema.",
        authHint: "This provider depends on an unofficial ChatGPT/Codex usage endpoint that may change without notice.",
        usageWindows: [],
      };
    }

    const sourceLabel = authSourceLabel(authStatus);
    const notes = [
      "Uses the unofficial ChatGPT/Codex GET /backend-api/wham/usage endpoint.",
      "OpenAI currently exposes percentage-based session and weekly counters here, not absolute message/token limits.",
      "The progress-bar notch marks the current point in the active time window.",
      ...parseNotes,
    ];

    if (response.plan_type) {
      notes.unshift(`Plan: ${response.plan_type}`);
    }

    if (response.credits?.has_credits) {
      const creditBalance = parseNumber(response.credits.balance);
      if (creditBalance != null) {
        notes.push(`Credits balance reported: ${creditBalance}`);
      }
    }

    if (response.spend_control?.reached) {
      notes.push("Spend control is currently marked as reached.");
    }

    const rateLimitResetCredits = parseNumber(response.rate_limit_reset_credits?.available_count);
    if (rateLimitResetCredits != null && rateLimitResetCredits > 0) {
      notes.push(`${rateLimitResetCredits} rate-limit reset credit(s) available.`);
    }

    return {
      state: "ready",
      implementationStatus: "implemented",
      statusLine: buildStatusLine(sessionWindow, weeklyWindow),
      description: "Live personal usage data for ChatGPT/Codex session and weekly limits.",
      authHint: [sourceLabel ? `token: ${sourceLabel}` : undefined, accountResolution.source ? `account id: ${accountResolution.source}` : undefined]
        .filter(Boolean)
        .join(" • "),
      usageHint: "Shows the current session/5-hour window and weekly/7-day window returned by the ChatGPT/Codex product API.",
      notes,
      usageWindows,
      lastUpdatedAt: new Date(),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "fetch failed",
      errorMessage: `Failed to load OpenAI Codex usage: ${message}`,
      authHint: "Verify the OpenAI/Codex login is still valid, then press r to retry.",
      usageWindows: [],
    };
  }
}

export const openAiCodexProvider: SubscriptionProviderDefinition = {
  id: "openai-codex",
  label: "OpenAI Codex",
  shortLabel: "OpenAI/Codex",
  enabledByDefault: true,
  implementationStatus: "implemented",
  description: "Live ChatGPT/Codex personal session and weekly usage view.",
  authHint: "Uses Pi-managed OpenAI/Codex auth plus a ChatGPT account id.",
  usageHint: "Uses the unofficial ChatGPT/Codex usage endpoint for personal subscription-style limits.",
  stability: "mixed",
  notes: [
    "This provider relies on an unofficial ChatGPT/Codex endpoint.",
    "The current implementation focuses on the session and weekly usage windows.",
  ],
  usageWindows: [
    { label: "Session", statusLabel: "loading…", notches: [25, 50, 75] },
    { label: "Weekly", statusLabel: "loading…", notches: [25, 50, 75] },
  ],
  loadRuntimeState: loadOpenAiCodexRuntimeState,
};

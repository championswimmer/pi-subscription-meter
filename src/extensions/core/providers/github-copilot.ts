import { execFileSync } from "node:child_process";
import { AuthStorage, type AuthStatus } from "@earendil-works/pi-coding-agent";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "./types.ts";

const COPILOT_USER_URL = "https://api.github.com/copilot_internal/user";
const COPILOT_TOKEN_EXCHANGE_URL = "https://api.github.com/copilot_internal/v2/token";
const COPILOT_TIMEOUT_MS = 20_000;
const COPILOT_VERSION = "0.35.0";
const EDITOR_VERSION = "vscode/1.107.0";

interface GitHubCopilotQuotaSnapshot {
  entitlement?: number | string;
  remaining?: number | string;
  quota_remaining?: number | string;
  percent_remaining?: number | string;
  overage_count?: number | string;
  overage_entitlement?: number | string;
  overage_permitted?: boolean;
  unlimited?: boolean;
  has_quota?: boolean;
  quota_id?: string;
  quota_reset_at?: number | string;
  token_based_billing?: boolean;
  timestamp_utc?: string;
}

interface GitHubCopilotUsageResponse {
  login?: string;
  copilot_plan?: string;
  access_type_sku?: string;
  quota_reset_date?: string;
  quota_reset_date_utc?: string;
  limited_user_reset_date?: string;
  quota_snapshots?: {
    premium_interactions?: GitHubCopilotQuotaSnapshot;
    chat?: GitHubCopilotQuotaSnapshot;
    completions?: GitHubCopilotQuotaSnapshot;
  };
  monthly_quotas?: {
    chat?: number | string;
    completions?: number | string;
  };
  limited_user_quotas?: {
    chat?: number | string;
    completions?: number | string;
  };
}

interface GitHubCopilotFetchResult {
  response: GitHubCopilotUsageResponse;
  authSource: string;
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

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
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

function parseDateish(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function inferMonthlyWindowStart(resetAt: Date): Date | undefined {
  const start = new Date(
    Date.UTC(
      resetAt.getUTCFullYear(),
      resetAt.getUTCMonth() - 1,
      resetAt.getUTCDate(),
      resetAt.getUTCHours(),
      resetAt.getUTCMinutes(),
      resetAt.getUTCSeconds(),
      resetAt.getUTCMilliseconds(),
    ),
  );
  return Number.isNaN(start.getTime()) ? undefined : start;
}

function monthlyWindowTiming(resetAt: Date | undefined): { pacePercent?: number } {
  if (!resetAt) {
    return {};
  }

  const start = inferMonthlyWindowStart(resetAt);
  if (!start) {
    return {};
  }

  const totalSeconds = Math.max(1, Math.round((resetAt.getTime() - start.getTime()) / 1000));
  const remainingSeconds = Math.max(0, Math.round((resetAt.getTime() - Date.now()) / 1000));
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);

  return {
    pacePercent: clampPercent((elapsedSeconds / totalSeconds) * 100),
  };
}

function copilotHeaders(authHeader: string): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: authHeader,
    "User-Agent": `GitHubCopilotChat/${COPILOT_VERSION}`,
    "Editor-Version": EDITOR_VERSION,
    "Editor-Plugin-Version": `copilot-chat/${COPILOT_VERSION}`,
    "Copilot-Integration-Id": "vscode-chat",
    "Content-Type": "application/json",
  };
}

function ghCliToken(): string | undefined {
  try {
    return execFileSync("gh", ["auth", "token"], {
      timeout: 5000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

function githubOAuthToken(authStorage: AuthStorage): string | undefined {
  const credential = authStorage.get("github-copilot") as Record<string, unknown> | undefined;
  if (credential?.type !== "oauth") {
    return undefined;
  }

  return typeof credential.refresh === "string" && credential.refresh.length > 0
    ? credential.refresh
    : undefined;
}

async function fetchCopilotJson<T>(url: string, authHeader: string): Promise<T> {
  const response = await fetch(url, {
    headers: copilotHeaders(authHeader),
    signal: AbortSignal.timeout(COPILOT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || response.statusText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function exchangeCopilotToken(baseToken: string): Promise<string | undefined> {
  const result = await fetchCopilotJson<{ token?: string }>(COPILOT_TOKEN_EXCHANGE_URL, `Bearer ${baseToken}`);
  return typeof result.token === "string" && result.token.length > 0 ? result.token : undefined;
}

async function tryUserEndpointWithAuthHeader(authHeader: string): Promise<GitHubCopilotUsageResponse> {
  return fetchCopilotJson<GitHubCopilotUsageResponse>(COPILOT_USER_URL, authHeader);
}

async function fetchGitHubCopilotUsage(authStorage: AuthStorage): Promise<GitHubCopilotFetchResult> {
  const storedOAuthToken = githubOAuthToken(authStorage);
  const providerAccessToken = await authStorage.getApiKey("github-copilot");
  const cliToken = ghCliToken();

  const candidates: Array<{ token?: string; source: string; tryExchange: boolean }> = [
    { token: storedOAuthToken, source: "Pi GitHub OAuth refresh token", tryExchange: true },
    { token: providerAccessToken, source: "Pi GitHub Copilot access token", tryExchange: true },
    { token: cliToken, source: "gh auth token", tryExchange: false },
  ];

  const seen = new Set<string>();
  let lastError: Error | undefined;

  for (const candidate of candidates) {
    const token = candidate.token;
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);

    if (candidate.tryExchange) {
      try {
        const exchanged = await exchangeCopilotToken(token);
        if (exchanged) {
          try {
            const response = await tryUserEndpointWithAuthHeader(`Bearer ${exchanged}`);
            return {
              response,
              authSource: `${candidate.source} → exchanged Copilot token`,
            };
          } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));
          }
        }
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    for (const authHeader of [`token ${token}`, `Bearer ${token}`]) {
      try {
        const response = await tryUserEndpointWithAuthHeader(authHeader);
        return {
          response,
          authSource: candidate.source,
        };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError ?? new Error("No usable GitHub Copilot token found.");
}

function createTimingDetails(resetAt: Date | undefined): { detailParts: string[]; pacePercent?: number } {
  const timing = monthlyWindowTiming(resetAt);
  const detailParts: string[] = [];

  if (timing.pacePercent != null) {
    detailParts.push(`${formatPercent(timing.pacePercent)} elapsed`);
  }

  return {
    detailParts,
    pacePercent: timing.pacePercent,
  };
}

function createSnapshotWindow(
  label: string,
  snapshot: GitHubCopilotQuotaSnapshot | undefined,
  resetAt: Date | undefined,
): SubscriptionUsageWindowDefinition {
  const { detailParts, pacePercent } = createTimingDetails(resetAt);

  if (!snapshot) {
    return {
      label,
      statusLabel: "Not reported",
      detailLabel: detailParts.length > 0 ? detailParts.join(" • ") : undefined,
      resetAt,
      pacePercent,
    };
  }

  if (snapshot.unlimited) {
    return {
      label,
      statusLabel: "Unlimited",
      detailLabel: detailParts.length > 0 ? detailParts.join(" • ") : undefined,
      resetAt,
      pacePercent,
    };
  }

  const entitlement = parseNumber(snapshot.entitlement) ?? 0;
  const remaining = parseNumber(snapshot.remaining) ?? parseNumber(snapshot.quota_remaining) ?? 0;
  const overageCount = parseNumber(snapshot.overage_count) ?? 0;
  const overagePermitted = !!snapshot.overage_permitted;

  if (entitlement <= 0) {
    const fallbackParts = [...detailParts];
    if (overagePermitted) {
      fallbackParts.push("overage ok");
    }
    return {
      label,
      statusLabel: "No cap reported",
      detailLabel: fallbackParts.length > 0 ? fallbackParts.join(" • ") : undefined,
      resetAt,
      pacePercent,
    };
  }

  const usedValue = Math.max(0, entitlement - remaining);
  const usedPercent = safePercent(usedValue, entitlement);
  const usageParts = [
    `${formatInteger(usedValue)}/${formatInteger(entitlement)}`,
    `${formatInteger(Math.max(0, remaining))} left`,
  ];

  if (overageCount > 0) {
    usageParts.push(`+${formatInteger(overageCount)} overage`);
  } else if (overagePermitted) {
    usageParts.push("overage ok");
  }

  return {
    label,
    usedPercent,
    detailLabel: [...usageParts, ...detailParts].join(" • "),
    resetAt,
    notches: [50, 75, 90],
    pacePercent,
  };
}

function createLegacyChatWindow(
  label: string,
  limitValue: number,
  remaining: number,
  resetAt: Date | undefined,
): SubscriptionUsageWindowDefinition {
  const { detailParts, pacePercent } = createTimingDetails(resetAt);
  const usedValue = Math.max(0, limitValue - remaining);

  return {
    label,
    usedPercent: safePercent(usedValue, limitValue),
    detailLabel: [
      `${formatInteger(usedValue)}/${formatInteger(limitValue)}`,
      `${formatInteger(Math.max(0, remaining))} left`,
      ...detailParts,
    ].join(" • "),
    resetAt,
    notches: [50, 75, 90],
    pacePercent,
  };
}

function parseGitHubCopilotWindows(response: GitHubCopilotUsageResponse): SubscriptionUsageWindowDefinition[] {
  const resetAt = parseDateish(response.quota_reset_date_utc ?? response.quota_reset_date ?? response.limited_user_reset_date);
  const snapshots = response.quota_snapshots;

  if (snapshots && typeof snapshots === "object") {
    return [
      createSnapshotWindow("Premium / month", snapshots.premium_interactions, resetAt),
      createSnapshotWindow("Chat / month", snapshots.chat, resetAt),
    ];
  }

  const legacyWindows: SubscriptionUsageWindowDefinition[] = [];
  const monthlyQuotas = response.monthly_quotas;
  const limitedUserQuotas = response.limited_user_quotas;

  if (monthlyQuotas && limitedUserQuotas) {
    const chatLimit = parseNumber(monthlyQuotas.chat) ?? 0;
    const chatRemaining = parseNumber(limitedUserQuotas.chat) ?? 0;
    if (chatLimit > 0) {
      legacyWindows.push(createLegacyChatWindow("Chat / month", chatLimit, chatRemaining, resetAt));
    }
  }

  if (legacyWindows.length === 1) {
    legacyWindows.unshift(createSnapshotWindow("Premium / month", undefined, resetAt));
  }

  return legacyWindows;
}

function buildStatusLine(windows: SubscriptionUsageWindowDefinition[]): string {
  const premium = windows.find((window) => window.label === "Premium / month");
  const chat = windows.find((window) => window.label === "Chat / month");
  const parts: string[] = [];

  if (premium) {
    parts.push(
      premium.usedPercent != null
        ? `premium ${formatPercent(premium.usedPercent)} used`
        : `premium ${premium.statusLabel?.toLowerCase() ?? "available"}`,
    );
  }

  if (chat) {
    parts.push(
      chat.usedPercent != null
        ? `chat ${formatPercent(chat.usedPercent)} used`
        : `chat ${chat.statusLabel?.toLowerCase() ?? "available"}`,
    );
  }

  return parts.join(" • ") || "live usage data";
}

export async function loadGitHubCopilotRuntimeState(): Promise<SubscriptionProviderRuntimeState> {
  const authStorage = AuthStorage.create();
  const authStatus = authStorage.getAuthStatus("github-copilot");

  try {
    const { response, authSource } = await fetchGitHubCopilotUsage(authStorage);
    const usageWindows = parseGitHubCopilotWindows(response);

    if (usageWindows.length === 0) {
      return {
        state: "error",
        implementationStatus: "implemented",
        statusLine: "schema mismatch",
        errorMessage: "GitHub Copilot returned usage data, but no premium/chat limits could be parsed from the current response schema.",
        authHint: "This provider depends on internal GitHub Copilot quota endpoints that may change without notice.",
        usageWindows: [],
      };
    }

    const notes = [
      "Uses the internal GitHub Copilot GET /copilot_internal/user endpoint.",
      "The progress-bar notch marks the current point in the monthly window.",
      "This implementation focuses on premium and chat limits first.",
    ];

    if (response.copilot_plan) {
      notes.unshift(`Plan: ${response.copilot_plan}`);
    } else if (response.access_type_sku) {
      notes.unshift(`SKU: ${response.access_type_sku}`);
    }

    const premiumWindow = usageWindows.find((window) => window.label === "Premium / month");
    const chatWindow = usageWindows.find((window) => window.label === "Chat / month");

    if (chatWindow?.statusLabel === "Unlimited") {
      notes.push("Chat is currently reported as unlimited on this plan.");
    }

    if (premiumWindow?.detailLabel?.includes("overage")) {
      notes.push("Premium interactions may allow or report overage depending on the current Copilot plan.");
    }

    return {
      state: "ready",
      implementationStatus: "implemented",
      statusLine: buildStatusLine(usageWindows),
      description: "Live personal GitHub Copilot premium and chat limit usage.",
      authHint: [authSourceLabel(authStatus) ? `stored auth: ${authSourceLabel(authStatus)}` : undefined, `active path: ${authSource}`]
        .filter(Boolean)
        .join(" • "),
      usageHint: "Shows the personal monthly premium and chat counters returned by GitHub Copilot’s internal user quota endpoint.",
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
      errorMessage: `Failed to load GitHub Copilot usage: ${message}`,
      authHint: "Verify GitHub/Copilot login is still valid, then press r to retry.",
      usageWindows: [],
    };
  }
}

export const githubCopilotProvider: SubscriptionProviderDefinition = {
  id: "github-copilot",
  label: "GitHub Copilot",
  shortLabel: "Copilot",
  enabledByDefault: true,
  implementationStatus: "implemented",
  description: "Live personal GitHub Copilot premium and chat limit usage.",
  authHint: "Uses Pi-managed GitHub Copilot auth, with GitHub token exchange/fallbacks when needed.",
  usageHint: "Uses internal GitHub Copilot quota endpoints for personal monthly counters.",
  stability: "mixed",
  notes: [
    "This provider relies on internal GitHub Copilot quota endpoints.",
    "The current implementation focuses on premium and chat limits.",
  ],
  usageWindows: [
    { label: "Premium / month", statusLabel: "loading…", notches: [50, 75, 90] },
    { label: "Chat / month", statusLabel: "loading…" },
  ],
  loadRuntimeState: loadGitHubCopilotRuntimeState,
};

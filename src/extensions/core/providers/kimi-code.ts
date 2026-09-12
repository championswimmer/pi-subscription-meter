import { createSubscriptionAuthStorage, type SubscriptionAuthStatus } from "../auth.ts";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "./types.ts";

// Undocumented Kimi For Coding API; keep this integration isolated and fail closed on schema changes.
// Mirrors the read-only usage call used by CodexBar's Kimi provider family and pi-provider-kimi-code:
// GET {base}/v1/usages with the Pi-managed kimi-coding OAuth token.
const KIMI_CODING_DEFAULT_BASE_URL = "https://api.kimi.com/coding";
const KIMI_CODING_USAGE_TIMEOUT_MS = 20_000;
const KIMI_CODING_MAX_RESPONSE_BYTES = 64 * 1024;

interface KimiUsageDetail {
  limit?: number;
  used?: number;
  remaining?: number;
  resetTime?: string;
}

interface KimiUsageLimit {
  window?: {
    duration?: number;
    timeUnit?: string;
  };
  detail?: KimiUsageDetail;
}

interface KimiUsagesResponse {
  user?: {
    membership?: {
      level?: string;
    };
  };
  usage?: KimiUsageDetail;
  limits?: KimiUsageLimit[];
  parallel?: {
    limit?: number;
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

// The Kimi usages API returns quota counters as numeric strings (e.g. "100"); accept both.
function parseKimiNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0 && value.length <= 32) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 256 ? value : undefined;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 80) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isOAuthCredential(value: unknown): boolean {
  const credential = asRecord(value);
  return credential?.type === "oauth" && typeof credential.access === "string" && credential.access.length > 0;
}

function authSourceLabel(authStatus: SubscriptionAuthStatus): string | undefined {
  if (authStatus.source === "stored") {
    return "Pi /login kimi-coding";
  }

  if (authStatus.source === "environment") {
    return authStatus.label ?? "environment";
  }

  return undefined;
}

function kimiCodingBaseUrl(): string {
  const override = process.env.KIMI_CODE_BASE_URL ?? process.env.KIMI_BASE_URL;
  const base = typeof override === "string" && override.trim().length > 0
    ? override.trim()
    : KIMI_CODING_DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > KIMI_CODING_MAX_RESPONSE_BYTES) {
    throw new Error("Kimi usage response exceeded the 64 KiB safety limit.");
  }

  if (!response.body) {
    throw new Error("Kimi usage response had no body.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > KIMI_CODING_MAX_RESPONSE_BYTES) {
        throw new Error("Kimi usage response exceeded the 64 KiB safety limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Kimi usage response was not valid JSON.");
  }
}

function parseUsageDetail(value: unknown): KimiUsageDetail | undefined {
  const detail = asRecord(value);
  if (!detail) {
    return undefined;
  }

  return {
    limit: parseKimiNumber(detail.limit),
    used: parseKimiNumber(detail.used),
    remaining: parseKimiNumber(detail.remaining),
    resetTime: parseOptionalString(detail.resetTime),
  };
}

function parseUsagesResponse(value: unknown): KimiUsagesResponse {
  const root = asRecord(value);
  if (!root) {
    throw new Error("Kimi usage response had an unexpected shape.");
  }

  const user = asRecord(root.user);
  const membership = asRecord(user?.membership);
  const limits = Array.isArray(root.limits)
    ? root.limits
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => !!item)
      .map((item) => {
        const window = asRecord(item.window);
        return {
          window: window
            ? {
              duration: parseKimiNumber(window.duration),
              timeUnit: parseOptionalString(window.timeUnit),
            }
            : undefined,
          detail: parseUsageDetail(item.detail),
        };
      })
    : undefined;
  const parallel = asRecord(root.parallel);

  return {
    user: membership ? { membership: { level: parseOptionalString(membership.level) } } : undefined,
    usage: parseUsageDetail(root.usage),
    limits,
    parallel: parallel ? { limit: parseKimiNumber(parallel.limit) } : undefined,
  };
}

async function fetchKimiUsages(accessToken: string): Promise<KimiUsagesResponse> {
  const response = await fetch(`${kimiCodingBaseUrl()}/v1/usages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "pi-subscription-meter/kimi-coding",
    },
    redirect: "error",
    signal: AbortSignal.timeout(KIMI_CODING_USAGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Kimi usage lookup returned HTTP ${response.status}.`);
  }

  return parseUsagesResponse(await readBoundedJson(response));
}

function usedPercentOf(detail: KimiUsageDetail | undefined): number | undefined {
  if (!detail || detail.limit == null || detail.limit <= 0) {
    return undefined;
  }
  if (detail.used != null) {
    return clampPercent((detail.used / detail.limit) * 100);
  }
  if (detail.remaining != null) {
    return clampPercent(((detail.limit - detail.remaining) / detail.limit) * 100);
  }
  return undefined;
}

function windowMinutes(window: { duration?: number; timeUnit?: string } | undefined): number | undefined {
  if (window?.duration == null || window.duration <= 0) {
    return undefined;
  }
  if (window.timeUnit === "TIME_UNIT_MINUTE") {
    return window.duration;
  }
  if (window.timeUnit === "TIME_UNIT_HOUR") {
    return window.duration * 60;
  }
  return undefined;
}

function windowLabel(minutes: number | undefined): string {
  if (minutes == null) {
    return "Rate limit";
  }
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return days === 7 ? "Weekly" : `${days}-day`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "Hourly" : `${hours}-hour`;
  }
  return `${minutes}-minute`;
}

function quotaWindow(detail: KimiUsageDetail | undefined, label: string): SubscriptionUsageWindowDefinition | undefined {
  const usedPercent = usedPercentOf(detail);
  const resetAt = parseDate(detail?.resetTime);
  if (usedPercent == null && !resetAt) {
    return undefined;
  }

  const remaining = detail?.remaining;
  const limit = detail?.limit;
  return {
    label,
    usedPercent,
    statusLabel: usedPercent == null ? "Usage not reported" : undefined,
    detailLabel: usedPercent != null && remaining != null && limit != null
      ? `${remaining}/${limit} remaining`
      : undefined,
    resetAt,
    notches: [50, 75, 90],
  };
}

export async function loadKimiCodeRuntimeState(): Promise<SubscriptionProviderRuntimeState> {
  const authStorage = createSubscriptionAuthStorage();
  const authStatus = authStorage.getAuthStatus("kimi-coding");
  const storedCredential = authStorage.get("kimi-coding");

  if (!isOAuthCredential(storedCredential)) {
    const apiKeyConfigured = authStatus.source === "environment" || asRecord(storedCredential)?.type === "api_key";
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: apiKeyConfigured ? "subscription login required" : "auth missing",
      errorMessage: apiKeyConfigured
        ? "KIMI_API_KEY provides billed Moonshot platform access, not Kimi Coding Plan quota. Run /login kimi-coding and sign in with your Coding Plan account."
        : "No Kimi Coding Plan OAuth credential found. Run /login kimi-coding and sign in.",
      authHint: "Uses the Pi-managed kimi-coding OAuth login; a platform API key is intentionally not used for this personal subscription meter.",
      usageWindows: [],
    };
  }

  const accessToken = await authStorage.getApiKey("kimi-coding", { includeFallback: false });
  if (!accessToken) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "auth unavailable",
      errorMessage: "The Pi Kimi login has no usable access token. Run /login kimi-coding again.",
      usageWindows: [],
    };
  }

  try {
    const response = await fetchKimiUsages(accessToken);
    const usageWindows = [
      quotaWindow(response.usage, "Weekly"),
      ...((response.limits ?? []).map((entry) =>
        quotaWindow(entry.detail, windowLabel(windowMinutes(entry.window)))
      )),
    ].filter((window): window is SubscriptionUsageWindowDefinition => !!window);

    if (usageWindows.length === 0) {
      return {
        state: "error",
        implementationStatus: "implemented",
        statusLine: "schema mismatch",
        errorMessage: "Kimi returned usage data but no recognizable quota window or percentage.",
        authHint: "This provider relies on an undocumented Kimi For Coding usages endpoint that may change without notice.",
        usageWindows: [],
      };
    }

    const primary = usageWindows[0]!;
    const membershipLevel = response.user?.membership?.level;
    const parallelLimit = response.parallel?.limit;
    const notes = [
      "Uses the undocumented Kimi For Coding GET /v1/usages endpoint (same read-only call CodexBar's Kimi provider family uses).",
      "Quota counters arrive as numeric strings and are parsed without inventing missing values.",
      ...(membershipLevel ? [`Membership tier reported by Kimi: ${membershipLevel}.`] : []),
      ...(parallelLimit != null ? [`Parallel coding sessions allowed on this plan: ${parallelLimit}.`] : []),
    ];

    return {
      state: "ready",
      implementationStatus: "implemented",
      statusLine: primary.usedPercent != null
        ? `${primary.label.toLowerCase()} ${Math.round(primary.usedPercent)}% used`
        : `${primary.label.toLowerCase()} quota active; usage not reported`,
      description: "Live Kimi Coding Plan usage for the current Pi kimi-coding login.",
      authHint: authSourceLabel(authStatus) ? `token: ${authSourceLabel(authStatus)}` : undefined,
      usageHint: "Shows the weekly Coding Plan quota plus the rolling short window reported by Kimi.",
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
      errorMessage: `Failed to load Kimi Coding Plan usage: ${message}`,
      authHint: "Verify the Kimi Coding Plan login is valid, then press r to retry.",
      usageWindows: [],
    };
  }
}

export const kimiCodeProvider: SubscriptionProviderDefinition = {
  id: "kimi-coding",
  label: "Kimi Coding Plan",
  shortLabel: "Kimi",
  enabledByDefault: true,
  implementationStatus: "implemented",
  description: "Live Kimi Coding Plan usage for the current Pi kimi-coding login.",
  authHint: "Run /login kimi-coding and sign in. KIMI_API_KEY is not used for Coding Plan quota.",
  usageHint: "Uses an undocumented Kimi For Coding usages endpoint for the weekly quota and rolling short window.",
  stability: "unofficial",
  notes: [
    "This provider relies on the undocumented Kimi For Coding GET /v1/usages endpoint.",
    "Not to be confused with Kilo Code, which is a separate product and provider.",
  ],
  usageWindows: [
    { label: "Weekly", statusLabel: "loading…", notches: [50, 75, 90] },
  ],
  loadRuntimeState: loadKimiCodeRuntimeState,
};

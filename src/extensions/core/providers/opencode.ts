import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSubscriptionAuthStorage, type SubscriptionAuthStatus } from "../auth.ts";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "./types.ts";

const OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const OPENCODE_CONSOLE_URL = "https://opencode.ai/";
const REQUEST_TIMEOUT_MS = 15_000;
const OPENCODE_AUTH_RELATIVE_PATH = join(".local", "share", "opencode", "auth.json");

/** Unofficial console billing page. 1e8 units = $1 for balance and monthlyUsage. */
const ZEN_BILLING_UNITS_PER_DOLLAR = 100_000_000;

/**
 * Official documented OpenCode Go spend limits.
 * @see https://opencode.ai/docs/go/
 */
const GO_WINDOW_LIMITS_USD = {
  rolling: 12,
  weekly: 30,
  monthly: 60,
} as const;

const GO_WINDOW_META = [
  { key: "rolling", label: "5h", limitUsd: GO_WINDOW_LIMITS_USD.rolling },
  { key: "weekly", label: "Weekly", limitUsd: GO_WINDOW_LIMITS_USD.weekly },
  { key: "monthly", label: "Monthly", limitUsd: GO_WINDOW_LIMITS_USD.monthly },
] as const;

const GO_API_KEY_ENV = ["OPENCODE_GO_API_KEY", "OPENCODE_API_KEY"] as const;
const ZEN_COOKIE_ENV = ["OPENCODE_AUTH_COOKIE", "OPENCODE_ZEN_COOKIE", "OPENCODE_COOKIE"] as const;
const ZEN_WORKSPACE_ENV = ["OPENCODE_WORKSPACE_ID", "OPENCODE_ZEN_WORKSPACE_ID"] as const;

interface OpenCodeResolvedAuth {
  goApiKey?: string;
  goKeySource?: string;
  zenApiKey?: string;
  zenKeySource?: string;
  authCookie?: string;
  cookieSource?: string;
  workspaceId?: string;
  workspaceSource?: string;
}

interface GoUsageWindowPayload {
  status?: unknown;
  percent?: unknown;
  resetsAt?: unknown;
}

interface GoUsageResponse {
  usage?: {
    rolling?: GoUsageWindowPayload;
    weekly?: GoUsageWindowPayload;
    monthly?: GoUsageWindowPayload;
  };
}

interface GoUsageResult {
  windows: SubscriptionUsageWindowDefinition[];
  weeklyRemainingLabel?: string;
  note: string;
}

interface ZenCredits {
  balanceUsd: number;
  usedUsd?: number;
  monthlyLimitUsd?: number;
}

interface ZenUsageResult {
  window: SubscriptionUsageWindowDefinition;
  remainingLabel: string;
  note: string;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function safePercent(used: number, limit: number): number | undefined {
  if (limit <= 0) {
    return undefined;
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

function formatRemainingPercent(usedPercent: number): string {
  const remaining = 100 - usedPercent;
  return `${remaining.toFixed(remaining % 1 === 0 ? 0 : 1)}% left`;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function firstEnv(names: readonly string[]): { value: string; name: string } | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return { value, name };
    }
  }
  return undefined;
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function extractApiKey(credential: unknown): string | undefined {
  const record = asRecord(credential);
  if (!record) {
    return undefined;
  }
  if (typeof record.key === "string" && record.key.trim().length > 0) {
    return record.key.trim();
  }
  if (typeof record.apiKey === "string" && record.apiKey.trim().length > 0) {
    return record.apiKey.trim();
  }
  return undefined;
}

function readOpenCodeAuthFile(): Record<string, unknown> | undefined {
  const xdg = process.env.XDG_DATA_HOME?.trim();
  const candidates = [
    xdg ? join(xdg, "opencode", "auth.json") : undefined,
    join(homedir(), OPENCODE_AUTH_RELATIVE_PATH),
  ].filter((path): path is string => Boolean(path));

  for (const path of candidates) {
    if (!existsSync(path)) {
      continue;
    }
    const parsed = asRecord(readJsonFile(path));
    if (parsed) {
      return parsed;
    }
  }
  return undefined;
}

function authSourceLabel(authStatus: SubscriptionAuthStatus): string | undefined {
  if (authStatus.source === "stored") {
    return "Pi /login opencode";
  }
  if (authStatus.source === "environment") {
    return authStatus.label ?? "environment";
  }
  if (authStatus.source === "fallback") {
    return authStatus.label ?? "fallback auth";
  }
  return undefined;
}

function resolveOpenCodeAuth(): OpenCodeResolvedAuth {
  const resolved: OpenCodeResolvedAuth = {};
  const localAuth = readOpenCodeAuthFile();
  const localGoKey = extractApiKey(localAuth?.["opencode-go"]);
  const localZenKey = extractApiKey(localAuth?.opencode);

  const goEnv = firstEnv(GO_API_KEY_ENV);
  if (goEnv) {
    resolved.goApiKey = goEnv.value;
    resolved.goKeySource = `env:${goEnv.name}`;
  } else if (localGoKey) {
    resolved.goApiKey = localGoKey;
    resolved.goKeySource = "~/.local/share/opencode/auth.json#opencode-go";
  } else if (localZenKey) {
    resolved.goApiKey = localZenKey;
    resolved.goKeySource = "~/.local/share/opencode/auth.json#opencode";
  }

  if (localZenKey) {
    resolved.zenApiKey = localZenKey;
    resolved.zenKeySource = "~/.local/share/opencode/auth.json#opencode";
  }

  const cookie = firstEnv(ZEN_COOKIE_ENV);
  if (cookie) {
    resolved.authCookie = cookie.value;
    resolved.cookieSource = `env:${cookie.name}`;
  }

  const workspace = firstEnv(ZEN_WORKSPACE_ENV);
  if (workspace) {
    resolved.workspaceId = workspace.value;
    resolved.workspaceSource = `env:${workspace.name}`;
  }

  return resolved;
}

async function attachPiOpenCodeKey(
  resolved: OpenCodeResolvedAuth,
  authStatus: SubscriptionAuthStatus,
): Promise<void> {
  const auth = createSubscriptionAuthStorage();
  const piKey = (await auth.getApiKey("opencode", { includeFallback: true }))?.trim();
  if (!piKey) {
    return;
  }
  const source = authSourceLabel(authStatus) ?? "pi-auth:opencode";
  if (!resolved.goApiKey) {
    resolved.goApiKey = piKey;
    resolved.goKeySource = source;
  }
  if (!resolved.zenApiKey) {
    resolved.zenApiKey = piKey;
    resolved.zenKeySource = source;
  }
}

function cookieHeader(rawCookie: string): string {
  const trimmed = rawCookie.trim();
  if (/^auth\s*=/i.test(trimmed) || trimmed.includes("=")) {
    return trimmed;
  }
  return `auth=${trimmed}`;
}

function redactSecrets(text: string, secrets: Array<string | undefined>): string {
  let out = text;
  for (const secret of secrets) {
    if (secret) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out;
}

function sanitizeError(error: unknown, secrets: Array<string | undefined>): string {
  if (error instanceof Error && error.name === "TimeoutError") {
    return "OpenCode request timed out.";
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return redactSecrets(error.message.replace(/\s+/g, " ").trim(), secrets);
  }
  return "Unknown OpenCode request error.";
}

async function fetchText(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string; finalUrl: string }> {
  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "follow",
  });
  return {
    status: response.status,
    body: await response.text(),
    finalUrl: response.url,
  };
}

function parseGoUsageWindow(
  payload: GoUsageWindowPayload | undefined,
  label: string,
  limitUsd: number,
): SubscriptionUsageWindowDefinition | undefined {
  const usedPercent = parseNumber(payload?.percent);
  if (usedPercent === undefined) {
    return undefined;
  }

  const clamped = clampPercent(usedPercent);
  const usedUsd = (limitUsd * clamped) / 100;
  const remainingUsd = Math.max(0, limitUsd - usedUsd);
  const rateLimited = payload?.status === "rate-limited";

  return {
    label,
    usedPercent: clamped,
    resetAt: parseDate(payload?.resetsAt),
    statusLabel: rateLimited ? "limited" : `${formatCurrency(remainingUsd)} left`,
    detailLabel: `${formatCurrency(usedUsd)}/${formatCurrency(limitUsd)} · ${formatRemainingPercent(clamped)}`,
    notches: [50, 75, 90],
  };
}

async function loadGoUsage(apiKey: string): Promise<GoUsageResult> {
  const { status, body } = await fetchText(OPENCODE_GO_USAGE_URL, {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "User-Agent": "pi-subscription-meter",
  });

  if (status === 401 || status === 403) {
    let detail = body.replace(/\s+/g, " ").trim().slice(0, 240);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
      const message = parsed.error?.message ?? parsed.message;
      if (typeof message === "string" && message.trim().length > 0) {
        detail = message.trim();
      }
    } catch {
      // keep raw body snippet
    }
    if (status === 403 && /subscription required|entitlement/i.test(detail)) {
      throw new Error(detail || "OpenCode Go subscription required.");
    }
    throw new Error(detail ? `OpenCode Go usage request failed (${status}). ${detail}` : `OpenCode Go usage request failed (${status}).`);
  }

  if (status < 200 || status >= 300) {
    throw new Error(`OpenCode Go usage request failed (${status}).`);
  }

  const parsed = JSON.parse(body) as GoUsageResponse;
  const usage = parsed.usage;
  if (!usage || typeof usage !== "object") {
    throw new Error("OpenCode Go usage response did not include a usage object.");
  }

  const windows: SubscriptionUsageWindowDefinition[] = [];
  for (const meta of GO_WINDOW_META) {
    const window = parseGoUsageWindow(usage[meta.key], meta.label, meta.limitUsd);
    if (window) {
      windows.push(window);
    }
  }

  if (windows.length === 0) {
    throw new Error("OpenCode Go usage response did not include any usable windows.");
  }

  const weekly = windows.find((window) => window.label === "Weekly");
  return {
    windows,
    weeklyRemainingLabel: weekly?.statusLabel,
    note: "Go usage is official GET /zen/go/v1/usage. Dollar remaining uses published $12 / $30 / $60 limits.",
  };
}

function unitsToUsd(value: number): number {
  return value / ZEN_BILLING_UNITS_PER_DOLLAR;
}

function monthlyLimitToUsd(value: number): number {
  return value >= 1_000_000 ? unitsToUsd(value) : value;
}

function extractWorkspaceId(text: string): string | undefined {
  return text.match(/\/workspace\/(wrk_[A-Za-z0-9]+)/)?.[1];
}

function parseJsonObjectFromText(text: string, startIndex: number): Record<string, unknown> | undefined {
  const start = text.indexOf("{", startIndex);
  if (start < 0) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return asRecord(JSON.parse(text.slice(start, index + 1)));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function parseZenBillingHtml(html: string): ZenCredits | undefined {
  const billingMarker = html.search(/billing\.get|monthlyUsage|monthlyLimit/);
  const object = billingMarker >= 0 ? parseJsonObjectFromText(html, billingMarker) : undefined;
  const balanceRaw = parseNumber(object?.balance);
  const usageRaw = parseNumber(object?.monthlyUsage);
  const limitRaw = parseNumber(object?.monthlyLimit);

  if (balanceRaw === undefined) {
    const balanceMatch = html.match(/"balance"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/);
    const usageMatch = html.match(/"monthlyUsage"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/);
    const limitMatch = html.match(/"monthlyLimit"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/);
    if (!balanceMatch) {
      return undefined;
    }
    return {
      balanceUsd: unitsToUsd(Number(balanceMatch[1])),
      usedUsd: usageMatch ? unitsToUsd(Number(usageMatch[1])) : undefined,
      monthlyLimitUsd: limitMatch ? monthlyLimitToUsd(Number(limitMatch[1])) : undefined,
    };
  }

  return {
    balanceUsd: unitsToUsd(balanceRaw),
    usedUsd: usageRaw === undefined ? undefined : unitsToUsd(usageRaw),
    monthlyLimitUsd: limitRaw === undefined ? undefined : monthlyLimitToUsd(limitRaw),
  };
}

async function discoverWorkspaceId(cookie: string): Promise<string | undefined> {
  const { body, finalUrl } = await fetchText(OPENCODE_CONSOLE_URL, {
    Cookie: cookieHeader(cookie),
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "pi-subscription-meter",
  });
  return extractWorkspaceId(finalUrl) ?? extractWorkspaceId(body);
}

async function loadZenUsage(cookie: string, workspaceId: string): Promise<ZenUsageResult> {
  const url = `https://opencode.ai/workspace/${workspaceId}/billing`;
  const { status, body } = await fetchText(url, {
    Cookie: cookieHeader(cookie),
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "pi-subscription-meter",
  });

  if (status === 401 || status === 403) {
    throw new Error("OpenCode Zen billing page rejected the console cookie.");
  }
  if (status < 200 || status >= 300) {
    throw new Error(`OpenCode Zen billing request failed (${status}).`);
  }

  const credits = parseZenBillingHtml(body);
  if (!credits) {
    throw new Error("OpenCode Zen billing page did not include parseable balance data.");
  }

  const usedPercent =
    credits.usedUsd !== undefined && credits.monthlyLimitUsd !== undefined
      ? safePercent(credits.usedUsd, credits.monthlyLimitUsd)
      : undefined;

  const remainingLabel = `${formatCurrency(credits.balanceUsd)} left`;
  const detailLabel =
    credits.usedUsd !== undefined && credits.monthlyLimitUsd !== undefined
      ? `${formatCurrency(credits.usedUsd)}/${formatCurrency(credits.monthlyLimitUsd)} used`
      : credits.usedUsd !== undefined
        ? `${formatCurrency(credits.usedUsd)} used`
        : remainingLabel;

  return {
    remainingLabel,
    note: "Zen dollars are unofficial workspace billing HTML scrape (1e8 units = $1). No official Zen balance API exists yet.",
    window: {
      label: "Zen Credits",
      usedPercent,
      statusLabel: remainingLabel,
      detailLabel,
      notches: [50, 75, 90],
    },
  };
}

function joinStatus(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" • ");
}

function uniqueNotes(notes: Array<string | undefined>): string[] {
  return [...new Set(notes.filter((note): note is string => Boolean(note)))];
}

export async function loadOpenCodeRuntimeState(): Promise<SubscriptionProviderRuntimeState> {
  const authStorage = createSubscriptionAuthStorage();
  const authStatus = authStorage.getAuthStatus("opencode");
  const resolved = resolveOpenCodeAuth();
  await attachPiOpenCodeKey(resolved, authStatus);
  const secrets = [resolved.goApiKey, resolved.zenApiKey, resolved.authCookie];

  if (!resolved.goApiKey && !resolved.authCookie) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "auth missing",
      errorMessage:
        "Add an OpenCode API key for Go (OPENCODE_GO_API_KEY / ~/.local/share/opencode/auth.json) and/or OPENCODE_AUTH_COOKIE + OPENCODE_WORKSPACE_ID for unofficial Zen dollars.",
      authHint:
        "Go uses a Bearer API key. Zen dollars still need an unofficial console cookie until OpenCode ships a balance API.",
      usageWindows: [],
    };
  }

  const [goResult, zenResult] = await Promise.all([
    (async (): Promise<{ go?: GoUsageResult; goError?: string }> => {
      if (!resolved.goApiKey) {
        return {};
      }
      try {
        return { go: await loadGoUsage(resolved.goApiKey) };
      } catch (error) {
        return { goError: sanitizeError(error, secrets) };
      }
    })(),
    (async (): Promise<{ zen?: ZenUsageResult; zenError?: string; workspaceId?: string; workspaceSource?: string }> => {
      if (!resolved.authCookie) {
        return {
          zenError:
            "Zen dollars need unofficial OPENCODE_AUTH_COOKIE + OPENCODE_WORKSPACE_ID until an official balance API exists.",
        };
      }
      try {
        const workspaceId = resolved.workspaceId ?? (await discoverWorkspaceId(resolved.authCookie));
        if (!workspaceId) {
          return { zenError: "OpenCode Zen needs OPENCODE_WORKSPACE_ID (or a cookie that can discover wrk_…)." };
        }
        return {
          zen: await loadZenUsage(resolved.authCookie, workspaceId),
          workspaceId,
          workspaceSource: resolved.workspaceId ? resolved.workspaceSource : "discovered from opencode.ai",
        };
      } catch (error) {
        return { zenError: sanitizeError(error, secrets) };
      }
    })(),
  ]);

  const go = goResult.go;
  const goError = goResult.goError;
  const zen = zenResult.zen;
  const zenError = zenResult.zenError;
  if (zenResult.workspaceId && !resolved.workspaceId) {
    resolved.workspaceId = zenResult.workspaceId;
    resolved.workspaceSource = zenResult.workspaceSource;
  }

  const usageWindows = [...(zen ? [zen.window] : []), ...(go?.windows ?? [])];
  if (usageWindows.length === 0) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "unavailable",
      errorMessage: joinStatus([goError, zenError]),
      authHint: joinStatus([
        resolved.goKeySource ? `Go key: ${resolved.goKeySource}` : undefined,
        resolved.cookieSource ? `Zen cookie: ${resolved.cookieSource}` : undefined,
      ]),
      usageWindows: [],
    };
  }

  return {
    state: "ready",
    implementationStatus: "implemented",
    statusLine: joinStatus([
      go?.weeklyRemainingLabel ? `Go weekly ${go.weeklyRemainingLabel}` : goError,
      zen ? `Zen ${zen.remainingLabel}` : undefined,
    ]),
    description: "OpenCode Go weekly remaining from the official usage API, plus unofficial Zen dollars left/used.",
    authHint: joinStatus([
      resolved.goKeySource ? `Go key: ${resolved.goKeySource}` : undefined,
      resolved.cookieSource ? `Zen cookie: ${resolved.cookieSource}` : undefined,
      resolved.workspaceSource ? `Zen workspace: ${resolved.workspaceSource}` : undefined,
    ]),
    usageHint: zen
      ? "Zen remaining/used dollars come from the unofficial billing page. Go remaining dollars use published $12 / $30 / $60 limits."
      : "Go remaining dollars are derived from official used-percent plus published $12 / $30 / $60 limits.",
    notes: uniqueNotes([
      go?.note,
      zen?.note,
      goError && zen ? `Go unavailable: ${goError}` : undefined,
      !zen && zenError ? zenError : undefined,
    ]),
    usageWindows,
    lastUpdatedAt: new Date(),
  };
}

export const opencodeProvider: SubscriptionProviderDefinition = {
  id: "opencode",
  label: "OpenCode",
  shortLabel: "OpenCode",
  enabledByDefault: true,
  implementationStatus: "implemented",
  description: "OpenCode Go weekly remaining plus unofficial Zen dollars left/used.",
  authHint:
    "Go: OPENCODE_GO_API_KEY, OPENCODE_API_KEY, or ~/.local/share/opencode/auth.json. Zen: OPENCODE_AUTH_COOKIE and OPENCODE_WORKSPACE_ID.",
  usageHint:
    "Go uses official GET /zen/go/v1/usage. Zen dollars come from an unofficial workspace billing scrape until a balance API exists.",
  stability: "mixed",
  notes: [
    "Go: official GET https://opencode.ai/zen/go/v1/usage with Bearer API key.",
    "Zen: unofficial GET https://opencode.ai/workspace/{id}/billing cookie scrape. No official Zen balance API yet.",
  ],
  usageWindows: [
    { label: "Zen Credits", statusLabel: "loading…", notches: [50, 75, 90] },
    { label: "5h", statusLabel: "loading…", notches: [50, 75, 90] },
    { label: "Weekly", statusLabel: "loading…", notches: [50, 75] },
    { label: "Monthly", statusLabel: "loading…", notches: [50, 75, 90] },
  ],
  loadRuntimeState: loadOpenCodeRuntimeState,
};

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AuthStorage } from "@earendil-works/pi-coding-agent";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "./types.ts";

const KILO_API_BASE = process.env.KILO_API_URL || "https://api.kilo.ai";
const KILO_PROFILE_URL = `${KILO_API_BASE}/api/profile`;
const KILO_BALANCE_URL = `${KILO_API_BASE}/api/profile/balance`;
const KILO_TIMEOUT_MS = 15_000;
const KILO_ENV_VARS = ["KILO_API_KEY", "KILOCODE_API_KEY", "KILO_CODE_API_KEY", "KILO_TOKEN", "KILOCODE_TOKEN", "KILO_CODE_TOKEN"];
const KILO_ORG_ENV_VARS = ["KILO_ORGANIZATION_ID", "KILOCODE_ORGANIZATION_ID", "KILO_CODE_ORGANIZATION_ID"];

interface KiloOrganization {
  id?: string;
  name?: string;
  role?: string;
}

interface KiloProfileResponse {
  user?: {
    id?: string;
    email?: string;
    name?: string;
  };
  email?: string;
  name?: string;
  organizations?: KiloOrganization[];
}

interface KiloBalanceResponse {
  balance?: number | string;
  isDepleted?: boolean;
  totalCredits?: number | string;
  total_credits?: number | string;
  creditsPurchased?: number | string;
  purchased_credits?: number | string;
  totalUsage?: number | string;
  total_usage?: number | string;
}

interface KiloResolvedAuth {
  accessToken?: string;
  organizationId?: string;
  authSource?: string;
  organizationSource?: string;
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

function safePercent(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return clampPercent((used / total) * 100);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function parsePiCredential(
  credential: Record<string, unknown> | undefined,
  sourceLabel: string,
): KiloResolvedAuth | undefined {
  if (!credential || typeof credential !== "object") {
    return undefined;
  }

  if (credential.type === "oauth" && typeof credential.access === "string" && credential.access.length > 0) {
    return {
      accessToken: credential.access,
      organizationId: typeof credential.accountId === "string" ? credential.accountId : undefined,
      authSource: sourceLabel,
      organizationSource: typeof credential.accountId === "string" ? sourceLabel : undefined,
    };
  }

  if (credential.type === "api_key" && typeof credential.key === "string" && credential.key.length > 0) {
    return {
      accessToken: credential.key,
      authSource: sourceLabel,
    };
  }

  return undefined;
}

function parseLocalKiloCredential(data: unknown): KiloResolvedAuth | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const kilo = (data as Record<string, unknown>).kilo;
  if (!kilo || typeof kilo !== "object") {
    return undefined;
  }

  const credential = kilo as Record<string, unknown>;
  if (credential.type === "oauth" && typeof credential.access === "string" && credential.access.length > 0) {
    return {
      accessToken: credential.access,
      organizationId: typeof credential.accountId === "string" ? credential.accountId : undefined,
      authSource: "~/.local/share/kilo/auth.json",
      organizationSource: typeof credential.accountId === "string" ? "~/.local/share/kilo/auth.json" : undefined,
    };
  }

  if (
    (credential.type === "api" || credential.type === "wellknown") &&
    typeof credential.key === "string" &&
    credential.key.length > 0
  ) {
    return {
      accessToken: credential.key,
      authSource: "~/.local/share/kilo/auth.json",
    };
  }

  return undefined;
}

function parseLegacyKiloConfig(data: unknown): KiloResolvedAuth | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const providers = (data as { providers?: unknown }).providers;
  if (!Array.isArray(providers)) {
    return undefined;
  }

  const provider = providers.find((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    return (entry as { provider?: unknown }).provider === "kilocode";
  }) as ({ kilocodeToken?: unknown; kilocodeOrganizationId?: unknown } | undefined);

  if (!provider || typeof provider.kilocodeToken !== "string" || provider.kilocodeToken.length === 0) {
    return undefined;
  }

  return {
    accessToken: provider.kilocodeToken,
    organizationId: typeof provider.kilocodeOrganizationId === "string" ? provider.kilocodeOrganizationId : undefined,
    authSource: "~/.kilocode/cli/config.json",
    organizationSource: typeof provider.kilocodeOrganizationId === "string" ? "~/.kilocode/cli/config.json" : undefined,
  };
}

function firstPresentEnv(names: string[]): { value?: string; name?: string } {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.length > 0) {
      return { value, name };
    }
  }

  return {};
}

function resolveKiloAuth(authStorage: AuthStorage): KiloResolvedAuth {
  const piKilocode = parsePiCredential(
    authStorage.get("kilocode") as Record<string, unknown> | undefined,
    "Pi auth.json (kilocode)",
  );
  if (piKilocode?.accessToken) {
    return piKilocode;
  }

  const piKilo = parsePiCredential(
    authStorage.get("kilo") as Record<string, unknown> | undefined,
    "Pi auth.json (kilo)",
  );
  if (piKilo?.accessToken) {
    return piKilo;
  }

  const localKilo = parseLocalKiloCredential(readJsonFile(join(homedir(), ".local", "share", "kilo", "auth.json")));
  if (localKilo?.accessToken) {
    return localKilo;
  }

  const legacyKilo = parseLegacyKiloConfig(readJsonFile(join(homedir(), ".kilocode", "cli", "config.json")));
  if (legacyKilo?.accessToken) {
    return legacyKilo;
  }

  const tokenEnv = firstPresentEnv(KILO_ENV_VARS);
  const orgEnv = firstPresentEnv(KILO_ORG_ENV_VARS);
  if (tokenEnv.value) {
    return {
      accessToken: tokenEnv.value,
      organizationId: orgEnv.value,
      authSource: tokenEnv.name,
      organizationSource: orgEnv.name,
    };
  }

  return {
    organizationId: orgEnv.value,
    organizationSource: orgEnv.name,
  };
}

async function fetchKiloJson<T>(url: string, accessToken: string, extraHeaders?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(KILO_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || response.statusText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchKiloProfile(accessToken: string): Promise<KiloProfileResponse> {
  return fetchKiloJson<KiloProfileResponse>(KILO_PROFILE_URL, accessToken);
}

async function fetchKiloBalance(accessToken: string, organizationId?: string): Promise<KiloBalanceResponse> {
  return fetchKiloJson<KiloBalanceResponse>(
    KILO_BALANCE_URL,
    accessToken,
    organizationId ? { "x-kilocode-organizationid": organizationId } : undefined,
  );
}

function reportedTotalCreditsFromBalance(response: KiloBalanceResponse): number | undefined {
  return parseNumber(response.totalCredits) ??
    parseNumber(response.total_credits) ??
    parseNumber(response.creditsPurchased) ??
    parseNumber(response.purchased_credits);
}

function totalUsageFromBalance(response: KiloBalanceResponse): number | undefined {
  return parseNumber(response.totalUsage) ?? parseNumber(response.total_usage);
}

function totalCreditsFromBalance(response: KiloBalanceResponse): number | undefined {
  const reportedTotal = reportedTotalCreditsFromBalance(response);
  if (reportedTotal != null) {
    return reportedTotal;
  }

  const balance = parseNumber(response.balance);
  const totalUsage = totalUsageFromBalance(response);
  if (balance == null || totalUsage == null) {
    return undefined;
  }

  return Math.max(0, balance) + Math.max(0, totalUsage);
}

function buildKiloUsageWindows(
  balanceResponse: KiloBalanceResponse,
  organizationLabel: string,
): SubscriptionUsageWindowDefinition[] {
  const balance = Math.max(0, parseNumber(balanceResponse.balance) ?? 0);
  const reportedTotalCredits = reportedTotalCreditsFromBalance(balanceResponse);
  const totalCredits = totalCreditsFromBalance(balanceResponse);
  const totalUsage = totalUsageFromBalance(balanceResponse);
  const windows: SubscriptionUsageWindowDefinition[] = [];

  windows.push({
    label: "Total Credits",
    statusLabel: totalCredits != null ? formatCurrency(totalCredits) : "Not reported",
    detailLabel: totalCredits == null
      ? "Kilo’s current balance API reports remaining credits, but not total purchased credits."
      : reportedTotalCredits == null && totalUsage != null
        ? `Inferred from ${formatCurrency(balance)} remaining + ${formatCurrency(totalUsage)} used`
        : totalUsage != null
          ? `${formatCurrency(totalUsage)} spent so far`
          : undefined,
    notches: [50, 75, 90],
  });

  windows.push({
    label: "Credits Left",
    usedPercent: totalCredits != null ? safePercent(Math.max(0, totalCredits - balance), totalCredits) : undefined,
    statusLabel: formatCurrency(balance),
    detailLabel: totalCredits != null
      ? `${formatCurrency(balance)} left • ${formatCurrency(Math.max(0, totalCredits - balance))} spent`
      : undefined,
    notches: [50, 75, 90],
  });

  windows.push({
    label: "Account",
    statusLabel: organizationLabel,
  });

  windows.push({
    label: "Credit Status",
    statusLabel: balanceResponse.isDepleted ? "Depleted" : "Available",
    detailLabel: balanceResponse.isDepleted
      ? "Paid-model requests may fail until you add more Kilo credits."
      : "Kilo currently reports this account as funded.",
  });

  return windows;
}

export async function loadKiloCodeRuntimeState(): Promise<SubscriptionProviderRuntimeState> {
  const authStorage = AuthStorage.create();
  const resolvedAuth = resolveKiloAuth(authStorage);

  if (!resolvedAuth.accessToken) {
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "auth missing",
      errorMessage: "No Kilo credential found. Configure KILO_API_KEY, use local Kilo auth, or store a kilocode/kilo credential in Pi auth.",
      authHint: "This provider can read Kilo auth from ~/.local/share/kilo/auth.json, legacy ~/.kilocode/cli/config.json, Pi auth.json, or KILO_API_KEY.",
      usageWindows: [],
    };
  }

  try {
    const [profileResult, balanceResult] = await Promise.allSettled([
      fetchKiloProfile(resolvedAuth.accessToken),
      fetchKiloBalance(resolvedAuth.accessToken, resolvedAuth.organizationId),
    ]);

    if (balanceResult.status !== "fulfilled") {
      throw balanceResult.reason;
    }

    const profile = profileResult.status === "fulfilled" ? profileResult.value : undefined;
    const balanceResponse = balanceResult.value;
    const balance = Math.max(0, parseNumber(balanceResponse.balance) ?? 0);
    const organizations = Array.isArray(profile?.organizations) ? profile.organizations : [];
    const currentOrganization = resolvedAuth.organizationId
      ? organizations.find((organization) => organization.id === resolvedAuth.organizationId)
      : undefined;
    const organizationLabel = currentOrganization?.name
      ? `${currentOrganization.name} (${currentOrganization.role ?? "team"})`
      : resolvedAuth.organizationId
        ? "Team"
        : "Personal";

    const notes = [
      "Uses Kilo’s source-exposed GET /api/profile and GET /api/profile/balance endpoints.",
      "Kilo’s stable account data currently centers on remaining balance, not OpenRouter-style daily/weekly/monthly budget windows.",
      "When Kilo reports both used and remaining credits, the provider infers total credits as used + remaining for the progress bar.",
      "When total purchased credits are not reported and usage is unavailable, the provider shows remaining balance and labels the total as not reported.",
    ];

    if (profile?.user?.email) {
      notes.unshift(`Account: ${profile.user.email}`);
    } else if (profile?.email) {
      notes.unshift(`Account: ${profile.email}`);
    }

    if (resolvedAuth.organizationId) {
      notes.push(`Organization context applied${resolvedAuth.organizationSource ? ` via ${resolvedAuth.organizationSource}` : ""}.`);
    }

    if (profileResult.status === "rejected") {
      notes.push("Profile metadata could not be loaded, but balance data was still available.");
    }

    return {
      state: "ready",
      implementationStatus: "implemented",
      statusLine: `${formatCurrency(balance)} credits left`,
      description: "Live Kilo Gateway account balance from the Kilo profile/balance API.",
      authHint: resolvedAuth.authSource ? `auth: ${resolvedAuth.authSource}` : undefined,
      usageHint: "Kilo currently exposes remaining credits here; total purchased credits may be inferred from used + remaining credits when both are reported, but historical usage windows may still be unavailable.",
      notes,
      usageWindows: buildKiloUsageWindows(balanceResponse, organizationLabel),
      lastUpdatedAt: new Date(),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: "error",
      implementationStatus: "implemented",
      statusLine: "fetch failed",
      errorMessage: `Failed to load Kilo balance: ${message}`,
      authHint: "Verify the Kilo credential is still valid, then press r to retry.",
      usageWindows: [],
    };
  }
}

export const kiloCodeProvider: SubscriptionProviderDefinition = {
  id: "kilocode",
  label: "Kilo Code",
  shortLabel: "Kilo",
  enabledByDefault: true,
  implementationStatus: "implemented",
  description: "Live Kilo Gateway balance and credit status for the current account.",
  authHint: "Reads local Kilo auth, Pi auth, or KILO_API_KEY when available.",
  usageHint: "Shows Kilo credits remaining instead of subscription session windows.",
  stability: "mixed",
  notes: [
    "This provider currently focuses on balance/credits remaining rather than session windows.",
    "Kilo does not currently expose stable OpenRouter-style daily/weekly/monthly budget windows here.",
  ],
  usageWindows: [
    { label: "Total Credits", statusLabel: "loading…", notches: [50, 75, 90] },
    { label: "Credits Left", statusLabel: "loading…", notches: [50, 75, 90] },
    { label: "Account", statusLabel: "loading…" },
    { label: "Credit Status", statusLabel: "loading…" },
  ],
  loadRuntimeState: loadKiloCodeRuntimeState,
};

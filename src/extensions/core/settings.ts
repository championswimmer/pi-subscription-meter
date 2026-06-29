import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { getDefaultEnabledProviderIds, subscriptionProviders, type SubscriptionProviderId } from "./providers/index.ts";

export type SubscriptionUsageDisplayMode = "used" | "remaining";
export type SubscriptionResetTimeDisplayMode = "absolute" | "relative";

export interface SubscriptionMeterSettings {
  version: 1;
  enabledProviders: SubscriptionProviderId[];
  displayMode: SubscriptionUsageDisplayMode;
  resetTimeDisplayMode: SubscriptionResetTimeDisplayMode;
  showThresholdNotches: boolean;
  showNowNotch: boolean;
}

const SETTINGS_FILE_NAME = "subscription-meter.json";
const SETTINGS_VERSION = 1;
const DEFAULT_DISPLAY_MODE: SubscriptionUsageDisplayMode = "used";
const DEFAULT_RESET_TIME_DISPLAY_MODE: SubscriptionResetTimeDisplayMode = "relative";
const DEFAULT_SHOW_THRESHOLD_NOTCHES = true;
const DEFAULT_SHOW_NOW_NOTCH = true;
const KNOWN_PROVIDER_IDS = new Set<SubscriptionProviderId>(subscriptionProviders.map((provider) => provider.id));

function normalizeEnabledProviderIds(providerIds: Iterable<string>): SubscriptionProviderId[] {
  const requested = new Set<string>(providerIds);
  return subscriptionProviders
    .map((provider) => provider.id)
    .filter((providerId): providerId is SubscriptionProviderId => {
      return requested.has(providerId) && KNOWN_PROVIDER_IDS.has(providerId);
    });
}

function normalizeDisplayMode(value: unknown): SubscriptionUsageDisplayMode {
  return value === "remaining" ? "remaining" : DEFAULT_DISPLAY_MODE;
}

function normalizeResetTimeDisplayMode(value: unknown): SubscriptionResetTimeDisplayMode {
  return value === "absolute" ? "absolute" : DEFAULT_RESET_TIME_DISPLAY_MODE;
}

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === "boolean" ? value : defaultValue;
}

function getDefaultSettings(): SubscriptionMeterSettings {
  return {
    version: SETTINGS_VERSION,
    enabledProviders: getDefaultEnabledProviderIds(),
    displayMode: DEFAULT_DISPLAY_MODE,
    resetTimeDisplayMode: DEFAULT_RESET_TIME_DISPLAY_MODE,
    showThresholdNotches: DEFAULT_SHOW_THRESHOLD_NOTCHES,
    showNowNotch: DEFAULT_SHOW_NOW_NOTCH,
  };
}

export function getSubscriptionMeterSettingsPath(): string {
  return join(getAgentDir(), SETTINGS_FILE_NAME);
}

export function loadSubscriptionMeterSettings(): SubscriptionMeterSettings {
  const settingsPath = getSubscriptionMeterSettingsPath();
  const defaults = getDefaultSettings();

  if (!existsSync(settingsPath)) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf-8")) as Partial<SubscriptionMeterSettings>;
    const enabledProviders = Array.isArray(parsed.enabledProviders)
      ? normalizeEnabledProviderIds(parsed.enabledProviders)
      : defaults.enabledProviders;

    return {
      version: SETTINGS_VERSION,
      enabledProviders,
      displayMode: normalizeDisplayMode(parsed.displayMode),
      resetTimeDisplayMode: normalizeResetTimeDisplayMode(parsed.resetTimeDisplayMode),
      showThresholdNotches: normalizeBoolean(parsed.showThresholdNotches, DEFAULT_SHOW_THRESHOLD_NOTCHES),
      showNowNotch: normalizeBoolean(parsed.showNowNotch, DEFAULT_SHOW_NOW_NOTCH),
    };
  } catch {
    return defaults;
  }
}

export function saveSubscriptionMeterSettings(settings: SubscriptionMeterSettings): SubscriptionMeterSettings {
  const normalizedSettings: SubscriptionMeterSettings = {
    version: SETTINGS_VERSION,
    enabledProviders: normalizeEnabledProviderIds(settings.enabledProviders),
    displayMode: normalizeDisplayMode(settings.displayMode),
    resetTimeDisplayMode: normalizeResetTimeDisplayMode(settings.resetTimeDisplayMode),
    showThresholdNotches: normalizeBoolean(settings.showThresholdNotches, DEFAULT_SHOW_THRESHOLD_NOTCHES),
    showNowNotch: normalizeBoolean(settings.showNowNotch, DEFAULT_SHOW_NOW_NOTCH),
  };

  const settingsPath = getSubscriptionMeterSettingsPath();
  const agentDir = getAgentDir();
  const tempPath = `${settingsPath}.tmp`;

  mkdirSync(agentDir, { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(normalizedSettings, null, 2)}\n`, "utf-8");
  renameSync(tempPath, settingsPath);

  return normalizedSettings;
}

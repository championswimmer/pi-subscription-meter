import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { getDefaultEnabledProviderIds, subscriptionProviders, type SubscriptionProviderId } from "./providers/index.ts";

export interface SubscriptionMeterSettings {
  version: 1;
  enabledProviders: SubscriptionProviderId[];
}

const SETTINGS_FILE_NAME = "subscription-meter.json";
const SETTINGS_VERSION = 1;
const KNOWN_PROVIDER_IDS = new Set<SubscriptionProviderId>(subscriptionProviders.map((provider) => provider.id));

function normalizeEnabledProviderIds(providerIds: Iterable<string>): SubscriptionProviderId[] {
  const requested = new Set<string>(providerIds);
  return subscriptionProviders
    .map((provider) => provider.id)
    .filter((providerId): providerId is SubscriptionProviderId => {
      return requested.has(providerId) && KNOWN_PROVIDER_IDS.has(providerId);
    });
}

function getDefaultSettings(): SubscriptionMeterSettings {
  return {
    version: SETTINGS_VERSION,
    enabledProviders: getDefaultEnabledProviderIds(),
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
    };
  } catch {
    return defaults;
  }
}

export function saveSubscriptionMeterSettings(settings: SubscriptionMeterSettings): SubscriptionMeterSettings {
  const normalizedSettings: SubscriptionMeterSettings = {
    version: SETTINGS_VERSION,
    enabledProviders: normalizeEnabledProviderIds(settings.enabledProviders),
  };

  const settingsPath = getSubscriptionMeterSettingsPath();
  const agentDir = getAgentDir();
  const tempPath = `${settingsPath}.tmp`;

  mkdirSync(agentDir, { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(normalizedSettings, null, 2)}\n`, "utf-8");
  renameSync(tempPath, settingsPath);

  return normalizedSettings;
}

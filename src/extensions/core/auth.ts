import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";

export interface SubscriptionAuthStatus {
  configured: boolean;
  source?: "stored" | "runtime" | "environment" | "fallback";
  label?: string;
}

export interface SubscriptionAuthStorage {
  get(provider: string): unknown;
  getAuthStatus(provider: string): SubscriptionAuthStatus;
  getApiKey(provider: string, options?: { includeFallback?: boolean }): Promise<string | undefined>;
}

interface OAuthCredential {
  type: "oauth";
  access?: string;
}

interface ApiKeyCredential {
  type: "api_key";
  key?: string;
  env?: Record<string, string>;
}

type StoredCredential = OAuthCredential | ApiKeyCredential | Record<string, unknown>;
type AuthStorageFactory = {
  create?: (authPath?: string) => SubscriptionAuthStorage;
};

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  "github-copilot": ["GITHUB_COPILOT_TOKEN", "GITHUB_TOKEN"],
  kilo: ["KILO_API_KEY", "KILOCODE_API_KEY", "KILO_CODE_API_KEY", "KILO_TOKEN", "KILOCODE_TOKEN", "KILO_CODE_TOKEN"],
  kilocode: ["KILO_API_KEY", "KILOCODE_API_KEY", "KILO_CODE_API_KEY", "KILO_TOKEN", "KILOCODE_TOKEN", "KILO_CODE_TOKEN"],
  openai: ["OPENAI_API_KEY"],
  "openai-codex": ["OPENAI_API_KEY", "OPENAI_ACCESS_TOKEN", "CHATGPT_ACCESS_TOKEN"],
  openrouter: ["OPENROUTER_API_KEY"],
};

class FallbackAuthStorage implements SubscriptionAuthStorage {
  private readonly data: Record<string, StoredCredential>;

  constructor() {
    this.data = readCompatAuthFile();
  }

  get(provider: string): unknown {
    return this.data[provider];
  }

  getAuthStatus(provider: string): SubscriptionAuthStatus {
    if (this.data[provider]) {
      return { configured: true, source: "stored" };
    }

    const envKey = findProviderEnvKey(provider);
    if (envKey) {
      return { configured: false, source: "environment", label: envKey };
    }

    return { configured: false };
  }

  async getApiKey(provider: string, options?: { includeFallback?: boolean }): Promise<string | undefined> {
    const credential = this.data[provider];

    if (credential && typeof credential === "object") {
      if (credential.type === "oauth") {
        const oauthCredential = credential as OAuthCredential;
        return typeof oauthCredential.access === "string" && oauthCredential.access.length > 0
          ? oauthCredential.access
          : undefined;
      }

      if (credential.type === "api_key") {
        const apiKeyCredential = credential as ApiKeyCredential;
        return resolveConfigValue(apiKeyCredential.key, apiKeyCredential.env);
      }
    }

    if (options?.includeFallback === false) {
      return undefined;
    }

    const envKey = findProviderEnvKey(provider);
    return envKey ? process.env[envKey] : undefined;
  }
}

function getAgentDirCompat(): string {
  if (typeof PiCodingAgent.getAgentDir === "function") {
    return PiCodingAgent.getAgentDir();
  }

  return join(homedir(), ".pi", "agent");
}

function readCompatAuthFile(): Record<string, StoredCredential> {
  const authPath = join(getAgentDirCompat(), "auth.json");
  if (!existsSync(authPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(authPath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, StoredCredential>
      : {};
  } catch {
    return {};
  }
}

function resolveConfigValue(value: unknown, env?: Record<string, string>): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  if (value.startsWith("${") && value.endsWith("}")) {
    const envKey = value.slice(2, -1);
    return env?.[envKey] ?? process.env[envKey];
  }

  if (value.startsWith("$") && value.length > 1) {
    const envKey = value.slice(1);
    return env?.[envKey] ?? process.env[envKey];
  }

  return value;
}

function findProviderEnvKey(provider: string): string | undefined {
  for (const envKey of PROVIDER_ENV_KEYS[provider] ?? []) {
    if (typeof process.env[envKey] === "string" && process.env[envKey]!.length > 0) {
      return envKey;
    }
  }

  return undefined;
}

export function getPiAgentDir(): string {
  return getAgentDirCompat();
}

export function createSubscriptionAuthStorage(): SubscriptionAuthStorage {
  const authStorageFactory = (PiCodingAgent as { AuthStorage?: AuthStorageFactory }).AuthStorage;
  if (authStorageFactory?.create) {
    return authStorageFactory.create();
  }

  return new FallbackAuthStorage();
}

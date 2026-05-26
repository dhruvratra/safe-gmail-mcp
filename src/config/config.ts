import { DEFAULT_PENDING_TTL_MINUTES } from "../constants.js";
import { ConfigError } from "../errors.js";
import { readJsonFile, writePrivateJson } from "../storage/privateFiles.js";
import { StatePaths } from "../storage/paths.js";
import { normalizeEmailAddress, normalizePolicyEntry } from "../email/validation.js";
import {
  DefaultOAuthClientMetadata,
  fetchDefaultOAuthClient,
} from "./defaultOAuthClient.js";

export interface LocalConfig {
  googleClientId?: string;
  googleClientSecret?: string;
  allowedRecipients?: string[];
  blockedRecipients?: string[];
  pendingTtlMinutes?: number;
  fromEmail?: string;
}

export interface ResolvedConfig {
  googleClientId?: string;
  googleClientIdSource?: "env" | "config" | "default";
  googleClientSecret?: string;
  googleClientSecretSource?: "env" | "config" | "default";
  allowedRecipients: string[];
  blockedRecipients: string[];
  pendingTtlMs: number;
  fromEmail?: string;
}

export class ConfigLoader {
  constructor(
    private readonly paths: StatePaths,
    private readonly loadDefaultOAuthClient: () => Promise<
      DefaultOAuthClientMetadata | undefined
    > = fetchDefaultOAuthClient,
  ) {}

  async load(): Promise<ResolvedConfig> {
    const config = await this.loadLocalConfig();
    const envClientId = process.env.SAFE_GMAIL_MCP_GOOGLE_CLIENT_ID?.trim();
    const envClientSecret =
      process.env.SAFE_GMAIL_MCP_GOOGLE_CLIENT_SECRET?.trim();
    const configClientId = config.googleClientId;
    const configClientSecret = config.googleClientSecret;
    const defaultOAuthClient =
      envClientId || configClientId ? undefined : await this.loadDefaultOAuthClient();
    const defaultClientId = defaultOAuthClient?.clientId;
    const defaultClientSecret = defaultOAuthClient?.clientSecret;

    const googleClientId = envClientId
      ? normalizeGoogleClientId(envClientId)
      : configClientId
        ? normalizeGoogleClientId(configClientId)
        : defaultClientId
          ? normalizeGoogleClientId(defaultClientId)
          : undefined;
    const googleClientIdSource = envClientId
      ? "env"
      : configClientId
        ? "config"
        : defaultClientId
          ? "default"
          : undefined;
    const googleClientSecret =
      envClientSecret || configClientSecret || defaultClientSecret || undefined;
    const googleClientSecretSource = envClientSecret
      ? "env"
      : configClientSecret
        ? "config"
        : defaultClientSecret
          ? "default"
          : undefined;

    const pendingTtlMinutes =
      config.pendingTtlMinutes ?? DEFAULT_PENDING_TTL_MINUTES;

    return {
      googleClientId,
      googleClientIdSource,
      googleClientSecret,
      googleClientSecretSource,
      allowedRecipients: normalizePolicyEntries(config.allowedRecipients ?? []),
      blockedRecipients: normalizePolicyEntries(config.blockedRecipients ?? []),
      pendingTtlMs: pendingTtlMinutes * 60 * 1000,
      fromEmail: config.fromEmail
        ? normalizeEmailAddress(config.fromEmail, "fromEmail")
        : undefined,
    };
  }

  async loadLocalConfig(): Promise<LocalConfig> {
    const raw = await readJsonFile<unknown>(this.paths.configFile);
    return validateConfig(raw);
  }

  async setGoogleClientId(clientId: string): Promise<void> {
    const config = await this.loadLocalConfig();
    config.googleClientId = normalizeGoogleClientId(clientId);
    await writePrivateJson(this.paths.configFile, config);
  }

  async setGoogleOAuthCredentials(
    clientId: string,
    clientSecret?: string,
  ): Promise<void> {
    const config = await this.loadLocalConfig();
    config.googleClientId = normalizeGoogleClientId(clientId);
    if (clientSecret !== undefined) {
      config.googleClientSecret = normalizeGoogleClientSecret(clientSecret);
    }
    await writePrivateJson(this.paths.configFile, config);
  }

  async deleteGoogleOAuthCredentials(): Promise<void> {
    const config = await this.loadLocalConfig();
    delete config.googleClientId;
    delete config.googleClientSecret;
    await writePrivateJson(this.paths.configFile, config);
  }

  configFileForDisplay(): string {
    return this.paths.display(this.paths.configFile);
  }
}

export function normalizeGoogleClientId(value: string): string {
  const normalized = optionalString(value, "googleClientId");
  if (!normalized) {
    throw new ConfigError("Google OAuth client ID is required.");
  }
  if (!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(normalized)) {
    throw new ConfigError(
      "Google OAuth client ID must look like YOUR_CLIENT_ID.apps.googleusercontent.com.",
    );
  }
  return normalized;
}

export function normalizeGoogleClientSecret(value: string): string {
  const normalized = optionalString(value, "googleClientSecret");
  if (!normalized) {
    throw new ConfigError("Google OAuth client secret is required.");
  }
  if (/[\r\n]/.test(normalized)) {
    throw new ConfigError("Google OAuth client secret cannot contain CR or LF.");
  }
  return normalized;
}

export function validateConfig(raw: unknown): LocalConfig {
  if (raw === undefined) {
    return {};
  }
  if (!isObject(raw)) {
    throw new ConfigError("Config file must contain a JSON object.");
  }

  const config = raw as Record<string, unknown>;
  const googleClientId = optionalString(config.googleClientId, "googleClientId");
  const googleClientSecret = optionalString(
    config.googleClientSecret,
    "googleClientSecret",
  );
  return {
    googleClientId: googleClientId
      ? normalizeGoogleClientId(googleClientId)
      : undefined,
    googleClientSecret: googleClientSecret
      ? normalizeGoogleClientSecret(googleClientSecret)
      : undefined,
    allowedRecipients: optionalStringArray(
      config.allowedRecipients,
      "allowedRecipients",
    ),
    blockedRecipients: optionalStringArray(
      config.blockedRecipients,
      "blockedRecipients",
    ),
    pendingTtlMinutes: optionalPositiveNumber(
      config.pendingTtlMinutes,
      "pendingTtlMinutes",
    ),
    fromEmail: optionalString(config.fromEmail, "fromEmail"),
  };
}

function normalizePolicyEntries(entries: string[]): string[] {
  return entries.map((entry) => normalizePolicyEntry(entry));
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ConfigError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ConfigError(`${field} must be an array of strings.`);
  }
  return value;
}

function optionalPositiveNumber(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 24 * 60
  ) {
    throw new ConfigError(`${field} must be a positive number of minutes.`);
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

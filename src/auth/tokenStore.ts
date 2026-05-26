import { AuthError } from "../errors.js";
import {
  readJsonFile,
  removeFileIfExists,
  writePrivateJson,
} from "../storage/privateFiles.js";
import { StatePaths } from "../storage/paths.js";

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt?: number;
  savedAt: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class TokenStore {
  constructor(private readonly paths: StatePaths) {}

  async load(): Promise<StoredTokens | undefined> {
    const tokens = await readJsonFile<StoredTokens>(this.paths.tokenFile);
    if (tokens === undefined) {
      return undefined;
    }
    if (!tokens.accessToken || typeof tokens.accessToken !== "string") {
      throw new AuthError("Token file is invalid. Run 'safe-gmail-mcp auth' again.");
    }
    return tokens;
  }

  async saveFromGoogleResponse(
    response: GoogleTokenResponse,
    existing?: StoredTokens,
  ): Promise<StoredTokens> {
    if (!response.access_token) {
      throw new AuthError("Google token response did not include an access token.");
    }
    const now = Date.now();
    const tokens: StoredTokens = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? existing?.refreshToken,
      tokenType: response.token_type ?? existing?.tokenType ?? "Bearer",
      scope: response.scope ?? existing?.scope,
      expiresAt:
        response.expires_in !== undefined
          ? now + response.expires_in * 1000
          : existing?.expiresAt,
      savedAt: new Date(now).toISOString(),
    };
    await writePrivateJson(this.paths.tokenFile, tokens);
    return tokens;
  }

  async delete(): Promise<boolean> {
    return removeFileIfExists(this.paths.tokenFile);
  }

  async hasUsableTokens(now = Date.now()): Promise<boolean> {
    const tokens = await this.load();
    if (!tokens) {
      return false;
    }
    return Boolean(tokens.refreshToken || (tokens.expiresAt && tokens.expiresAt > now));
  }

  tokenFileForDisplay(): string {
    return this.paths.display(this.paths.tokenFile);
  }
}

import {
  GMAIL_SEND_SCOPE,
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
} from "../constants.js";
import { AuthError } from "../errors.js";
import { GoogleTokenResponse, StoredTokens, TokenStore } from "./tokenStore.js";

export interface AuthorizationUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}

export class GoogleOAuthClient {
  constructor(
    private readonly clientId: string,
    private readonly tokenStore: TokenStore,
    private readonly clientSecret?: string,
  ) {}

  buildAuthorizationUrl(options: AuthorizationUrlOptions): string {
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", options.clientId);
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GMAIL_SEND_SCOPE);
    url.searchParams.set("state", options.state);
    url.searchParams.set("code_challenge", options.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<StoredTokens> {
    const response = await tokenRequest(withClientSecret({
      client_id: this.clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }, this.clientSecret));
    return this.tokenStore.saveFromGoogleResponse(response);
  }

  async getAccessToken(now = Date.now()): Promise<string> {
    const tokens = await this.tokenStore.load();
    if (!tokens) {
      throw new AuthError("Gmail is not connected. Run 'safe-gmail-mcp auth'.");
    }
    if (tokens.expiresAt && tokens.expiresAt > now + 60_000) {
      return tokens.accessToken;
    }
    if (!tokens.refreshToken) {
      throw new AuthError("Gmail token expired. Run 'safe-gmail-mcp auth' again.");
    }
    const refreshed = await tokenRequest(withClientSecret({
      client_id: this.clientId,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }, this.clientSecret));
    const saved = await this.tokenStore.saveFromGoogleResponse(refreshed, tokens);
    return saved.accessToken;
  }
}

function withClientSecret(
  params: Record<string, string>,
  clientSecret?: string,
): Record<string, string> {
  return clientSecret ? { ...params, client_secret: clientSecret } : params;
}

async function tokenRequest(params: Record<string, string>): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  const body = (await response.json().catch(() => undefined)) as
    | Record<string, unknown>
    | undefined;

  if (!response.ok) {
    const description =
      typeof body?.error_description === "string"
        ? `: ${body.error_description.slice(0, 200)}`
        : "";
    const summary =
      typeof body?.error === "string"
        ? body.error + description
        : `HTTP ${response.status}`;
    throw new AuthError(`Google OAuth token exchange failed: ${summary}`);
  }

  return body as unknown as GoogleTokenResponse;
}

import { GMAIL_API_BASE_URL } from "../../constants.js";
import { GoogleOAuthClient } from "../../auth/googleOAuth.js";
import { SafeGmailError } from "../../errors.js";

export class GmailRequest {
  constructor(private readonly oauthClient: GoogleOAuthClient) {}

  async get<T>(path: string, params?: URLSearchParams): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    params?: URLSearchParams,
  ): Promise<T> {
    const accessToken = await this.oauthClient.getAccessToken();
    const url = new URL(`${GMAIL_API_BASE_URL}/users/me/${path}`);
    if (params) {
      url.search = params.toString();
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const responseBody = (await response.json().catch(() => undefined)) as
      | Record<string, unknown>
      | undefined;
    if (!response.ok) {
      throw new SafeGmailError(`Gmail API failed: ${errorMessage(response, responseBody)}`);
    }
    return responseBody as T;
  }
}

function errorMessage(
  response: Response,
  body: Record<string, unknown> | undefined,
): string {
  if (
    typeof body?.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return `HTTP ${response.status}`;
}

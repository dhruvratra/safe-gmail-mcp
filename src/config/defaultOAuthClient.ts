import { DEFAULT_OAUTH_CLIENT_METADATA_URL, GMAIL_SEND_SCOPE } from "../constants.js";

export interface DefaultOAuthClientMetadata {
  clientId: string;
  clientSecret: string;
}

export async function fetchDefaultOAuthClient(
  metadataUrl = process.env.SAFE_GMAIL_MCP_DEFAULT_OAUTH_URL ??
    DEFAULT_OAUTH_CLIENT_METADATA_URL,
): Promise<DefaultOAuthClientMetadata | undefined> {
  let response: Response;
  try {
    response = await fetch(metadataUrl, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  const body = (await response.json().catch(() => undefined)) as
    | Record<string, unknown>
    | undefined;
  if (!body) {
    return undefined;
  }

  if (body.scope !== undefined && body.scope !== GMAIL_SEND_SCOPE) {
    return undefined;
  }

  if (typeof body.clientId !== "string" || typeof body.clientSecret !== "string") {
    return undefined;
  }

  const clientId = body.clientId.trim();
  const clientSecret = body.clientSecret.trim();
  if (!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    return undefined;
  }
  if (!clientSecret || /[\r\n]/.test(clientSecret)) {
    return undefined;
  }

  return {
    clientId,
    clientSecret,
  };
}

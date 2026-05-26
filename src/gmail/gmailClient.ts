import { GMAIL_SEND_URL } from "../constants.js";
import { SafeGmailError } from "../errors.js";
import { GoogleOAuthClient } from "../auth/googleOAuth.js";

export interface GmailSendResult {
  id: string;
}

export interface GmailSender {
  sendRaw(rawBase64Url: string): Promise<GmailSendResult>;
}

export class GoogleGmailClient implements GmailSender {
  constructor(private readonly oauthClient: GoogleOAuthClient) {}

  async sendRaw(rawBase64Url: string): Promise<GmailSendResult> {
    const accessToken = await this.oauthClient.getAccessToken();
    const response = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ raw: rawBase64Url }),
    });

    const body = (await response.json().catch(() => undefined)) as
      | Record<string, unknown>
      | undefined;

    if (!response.ok) {
      const message =
        typeof body?.error === "object" &&
        body.error !== null &&
        "message" in body.error &&
        typeof body.error.message === "string"
          ? body.error.message
          : `HTTP ${response.status}`;
      throw new SafeGmailError(`Gmail send failed: ${message}`);
    }

    if (typeof body?.id !== "string") {
      throw new SafeGmailError("Gmail send response did not include a message ID.");
    }

    return { id: body.id };
  }
}

export const APP_NAME = "Safe Gmail MCP";
export const PACKAGE_NAME = "safe-gmail-mcp";
export const VERSION = "0.1.0";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const DEFAULT_PENDING_TTL_MINUTES = 10;
export const DEFAULT_PENDING_TTL_MS = DEFAULT_PENDING_TTL_MINUTES * 60 * 1000;
export const MAX_BULK_MESSAGES = 25;
export const DEFAULT_OAUTH_CLIENT_METADATA_URL =
  "https://www.meditatewithbliss.com/.well-known/safe-gmail-mcp/oauth-client.json";

export const EXPECTED_TOOL_NAMES = [
  "prepare_send_email",
  "confirm_send_email",
  "list_pending_sends",
  "discard_pending_send",
  "prepare_bulk_send",
  "confirm_bulk_send",
  "list_pending_bulk_sends",
  "discard_pending_bulk_send",
] as const;

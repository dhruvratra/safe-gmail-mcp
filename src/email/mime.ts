import { randomBytes } from "node:crypto";
import { CanonicalEmailPayload } from "./types.js";
import { normalizeEmailAddress, validateHeaderValue } from "./validation.js";

export function buildGmailRawMessage(
  payload: CanonicalEmailPayload,
  fromEmail?: string,
): string {
  const rawMessage = buildRfc822Message(payload, fromEmail);
  return base64UrlEncode(rawMessage);
}

export function buildRfc822Message(
  payload: CanonicalEmailPayload,
  fromEmail?: string,
): string {
  validateHeaderValue(payload.subject, "subject");
  const headers: string[] = [
    header("Date", new Date().toUTCString()),
  ];

  if (fromEmail) {
    headers.push(header("From", `<${normalizeEmailAddress(fromEmail, "fromEmail")}>`));
  }

  headers.push(header("To", payload.to.join(", ")));
  if (payload.cc.length > 0) {
    headers.push(header("Cc", payload.cc.join(", ")));
  }
  if (payload.bcc.length > 0) {
    headers.push(header("Bcc", payload.bcc.join(", ")));
  }
  headers.push(header("Subject", encodeHeaderValue(payload.subject)));
  headers.push(header("MIME-Version", "1.0"));

  if (payload.htmlBody === null) {
    return [
      ...headers,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      normalizeBody(payload.body),
    ].join("\r\n");
  }

  const boundary = "safe-gmail-mcp-" + randomBytes(12).toString("hex");
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeBody(payload.body),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeBody(payload.htmlBody),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function header(name: string, value: string): string {
  validateHeaderValue(value, name);
  return `${name}: ${value}`;
}

function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function normalizeBody(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r\n");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

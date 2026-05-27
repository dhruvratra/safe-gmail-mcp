import {
  EmailHeaderSummary,
  GmailHeader,
  GmailMessageResponse,
  NormalizedEmailHeaders,
} from "./types.js";

const HEADER_NAMES = ["From", "To", "Cc", "Subject", "Date", "Message-ID"] as const;

export function metadataHeaderParams(): URLSearchParams {
  const params = new URLSearchParams({ format: "metadata" });
  for (const header of HEADER_NAMES) {
    params.append("metadataHeaders", header);
  }
  return params;
}

export function summarizeMessage(message: GmailMessageResponse): EmailHeaderSummary {
  const messageId = requiredString(message.id, "Gmail message response missing ID.");
  return {
    messageId,
    threadId: message.threadId,
    snippet: message.snippet,
    labelIds: message.labelIds ?? [],
    internalDate: message.internalDate,
    ...normalizeHeaders(message.payload?.headers ?? []),
  };
}

export function normalizeHeaders(headers: GmailHeader[]): NormalizedEmailHeaders {
  return {
    from: headerValue(headers, "From"),
    to: splitAddressHeader(headerValue(headers, "To")),
    cc: splitAddressHeader(headerValue(headers, "Cc")),
    subject: headerValue(headers, "Subject"),
    date: headerValue(headers, "Date"),
    rfcMessageId: headerValue(headers, "Message-ID"),
  };
}

function headerValue(headers: GmailHeader[], name: string): string | undefined {
  const header = headers.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value;
}

function splitAddressHeader(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(message);
  }
  return value;
}

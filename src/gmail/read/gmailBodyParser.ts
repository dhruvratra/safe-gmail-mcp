import { GmailMessagePart } from "./types.js";

export interface ParsedEmailBody {
  textBody: string;
  htmlBody?: string;
}

export function parseEmailBody(payload: GmailMessagePart | undefined): ParsedEmailBody {
  const textParts: string[] = [];
  const htmlParts: string[] = [];
  collectBodyParts(payload, textParts, htmlParts);
  return {
    textBody: textParts.join("\n\n"),
    htmlBody: htmlParts.length > 0 ? htmlParts.join("\n\n") : undefined,
  };
}

function collectBodyParts(
  part: GmailMessagePart | undefined,
  textParts: string[],
  htmlParts: string[],
): void {
  if (!part) {
    return;
  }

  for (const child of part.parts ?? []) {
    collectBodyParts(child, textParts, htmlParts);
  }

  if (part.filename || part.body?.attachmentId || !part.body?.data) {
    return;
  }

  const decoded = decodeBase64Url(part.body.data);
  if (part.mimeType === "text/plain") {
    textParts.push(decoded);
  }
  if (part.mimeType === "text/html") {
    htmlParts.push(decoded);
  }
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

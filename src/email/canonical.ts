import { createHash } from "node:crypto";
import { EmailDraftInput, CanonicalEmailPayload } from "./types.js";
import { normalizeRecipientList, validateEmailDraft } from "./validation.js";

export function canonicalizeEmailDraft(
  input: EmailDraftInput,
): CanonicalEmailPayload {
  validateEmailDraft(input);
  return {
    to: normalizeRecipientList(input.to, "to").sort(),
    cc: normalizeRecipientList(input.cc ?? [], "cc").sort(),
    bcc: normalizeRecipientList(input.bcc ?? [], "bcc").sort(),
    subject: input.subject,
    body: input.body,
    htmlBody: input.htmlBody ?? null,
  };
}

export function canonicalEmailJson(payload: CanonicalEmailPayload): string {
  return JSON.stringify({
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    body: payload.body,
    htmlBody: payload.htmlBody,
  });
}

export function digestEmailPayload(payload: CanonicalEmailPayload): string {
  return createHash("sha256").update(canonicalEmailJson(payload), "utf8").digest("hex");
}

export function allRecipients(payload: CanonicalEmailPayload): string[] {
  return [...payload.to, ...payload.cc, ...payload.bcc];
}

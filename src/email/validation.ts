import { SafeGmailError } from "../errors.js";
import { EmailDraftInput } from "./types.js";

const SIMPLE_EMAIL_RE =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

const SIMPLE_DOMAIN_RE =
  /^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

export function validateEmailDraft(input: EmailDraftInput): void {
  if (!Array.isArray(input.to) || input.to.length === 0) {
    throw new SafeGmailError("At least one 'to' recipient is required.");
  }

  normalizeRecipientList(input.to, "to");
  normalizeRecipientList(input.cc ?? [], "cc");
  normalizeRecipientList(input.bcc ?? [], "bcc");
  validateHeaderValue(input.subject, "subject");

  if (typeof input.body !== "string") {
    throw new SafeGmailError("body must be a string.");
  }
  if (input.htmlBody !== undefined && typeof input.htmlBody !== "string") {
    throw new SafeGmailError("htmlBody must be a string when provided.");
  }
}

export function normalizeRecipientList(values: string[], field: string): string[] {
  if (!Array.isArray(values)) {
    throw new SafeGmailError(`${field} must be an array of email addresses.`);
  }
  return values.map((value) => normalizeEmailAddress(value, field));
}

export function normalizeEmailAddress(value: string, field = "email"): string {
  if (typeof value !== "string") {
    throw new SafeGmailError(`${field} must contain strings only.`);
  }
  validateHeaderValue(value, field);
  const trimmed = value.trim().toLowerCase();
  if (!SIMPLE_EMAIL_RE.test(trimmed)) {
    throw new SafeGmailError(`Invalid email address in ${field}.`);
  }
  return trimmed;
}

export function normalizePolicyEntry(entry: string): string {
  validateHeaderValue(entry, "recipient policy entry");
  const normalized = entry.trim().toLowerCase().replace(/^@/, "");
  if (!normalized) {
    throw new SafeGmailError("Recipient policy entries cannot be empty.");
  }
  if (normalized.includes("@")) {
    return normalizeEmailAddress(normalized, "recipient policy entry");
  }
  if (!SIMPLE_DOMAIN_RE.test(normalized)) {
    throw new SafeGmailError("Recipient policy domain entry is invalid.");
  }
  return normalized;
}

export function validateHeaderValue(value: string, field: string): void {
  if (typeof value !== "string") {
    throw new SafeGmailError(`${field} must be a string.`);
  }
  if (/[\r\n]/.test(value)) {
    throw new SafeGmailError(`${field} cannot contain CR or LF characters.`);
  }
}

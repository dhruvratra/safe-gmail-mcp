import { SafeGmailError } from "../errors.js";

export interface RecipientPolicyConfig {
  allowedRecipients: string[];
  blockedRecipients: string[];
}

export class RecipientPolicy {
  constructor(private readonly config: RecipientPolicyConfig) {}

  assertAllowed(recipients: string[]): void {
    for (const recipient of recipients) {
      if (matchesAny(recipient, this.config.blockedRecipients)) {
        throw new SafeGmailError(`Recipient is blocked by local policy: ${recipient}`);
      }
    }

    if (this.config.allowedRecipients.length === 0) {
      return;
    }

    for (const recipient of recipients) {
      if (!matchesAny(recipient, this.config.allowedRecipients)) {
        throw new SafeGmailError(
          `Recipient is not in the local allowlist: ${recipient}`,
        );
      }
    }
  }
}

function matchesAny(email: string, entries: string[]): boolean {
  return entries.some((entry) => matchesEntry(email, entry));
}

function matchesEntry(email: string, entry: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const domain = normalizedEmail.split("@")[1] ?? "";
  if (entry.includes("@")) {
    return normalizedEmail === entry;
  }
  return domain === entry;
}

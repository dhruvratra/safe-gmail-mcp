import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AuditLogger } from "../dist/audit/auditLogger.js";
import { BulkPendingStore } from "../dist/pending/bulkPendingStore.js";
import { PendingStore } from "../dist/pending/pendingStore.js";
import { RecipientPolicy } from "../dist/security/recipientPolicy.js";
import { SendEmailService } from "../dist/services/sendEmailService.js";
import { StatePaths } from "../dist/storage/paths.js";

export async function tempPaths() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "safe-gmail-mcp-test-"));
  return new StatePaths(dir);
}

export class MockGmailSender {
  sent = [];

  async sendRaw(rawBase64Url) {
    this.sent.push(rawBase64Url);
    return { id: `mock-message-${this.sent.length}` };
  }
}

export class StaticAuthStatus {
  constructor(authenticated) {
    this.authenticated = authenticated;
  }

  async isAuthenticated() {
    return this.authenticated;
  }
}

export async function makeService(options = {}) {
  const paths = options.paths ?? (await tempPaths());
  const gmail = options.gmail ?? new MockGmailSender();
  const service = new SendEmailService(
    new PendingStore(paths),
    new BulkPendingStore(paths),
    new RecipientPolicy({
      allowedRecipients: options.allowedRecipients ?? [],
      blockedRecipients: options.blockedRecipients ?? [],
    }),
    new AuditLogger(paths),
    gmail,
    new StaticAuthStatus(options.authenticated ?? true),
    {
      sendEnabled: options.sendEnabled ?? true,
      bulkSendEnabled: options.bulkSendEnabled ?? true,
      pendingTtlMs: options.pendingTtlMs ?? 10 * 60 * 1000,
      fromEmail: options.fromEmail,
    },
  );
  return { service, gmail, paths };
}

export function validDraft(overrides = {}) {
  return {
    to: ["person@example.com"],
    subject: "Hello",
    body: "Plain text body",
    ...overrides,
  };
}

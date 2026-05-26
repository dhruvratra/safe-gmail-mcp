import { AuthStatusProvider } from "../auth/authStatus.js";
import { AuditLogger } from "../audit/auditLogger.js";
import { MAX_BULK_MESSAGES } from "../constants.js";
import {
  allRecipients,
  canonicalEmailJson,
  canonicalizeEmailDraft,
  digestEmailPayload,
} from "../email/canonical.js";
import { buildGmailRawMessage } from "../email/mime.js";
import { EmailDraftInput, EmailPreview } from "../email/types.js";
import { SafeGmailError, publicErrorMessage } from "../errors.js";
import { GmailSender } from "../gmail/gmailClient.js";
import { BulkPendingStore, PendingBulkSendRecord } from "../pending/bulkPendingStore.js";
import { PendingSendRecord, PendingStore } from "../pending/pendingStore.js";
import { RecipientPolicy } from "../security/recipientPolicy.js";
import { createHash } from "node:crypto";

export interface PreparedSend {
  pendingId: string;
  digest: string;
  preview: EmailPreview;
}

export interface PreparedBulkSend {
  pendingBulkId: string;
  digest: string;
  preview: {
    messageCount: number;
    totalRecipientCount: number;
    recipients: string[];
    subjects: string[];
    expiresAt: string;
  };
}

export interface PendingSendSummary {
  pendingId: string;
  recipients: string[];
  subject: string;
  createdAt: string;
  expiresAt: string;
  digest: string;
}

export interface PendingBulkSendSummary {
  pendingBulkId: string;
  messageCount: number;
  totalRecipientCount: number;
  recipients: string[];
  subjects: string[];
  createdAt: string;
  expiresAt: string;
  digest: string;
}

export interface ConfirmSendResult {
  gmailMessageId: string;
}

export interface ConfirmBulkSendResult {
  gmailMessageIds: string[];
  sentCount: number;
}

export interface SendEmailServiceOptions {
  sendEnabled: boolean;
  bulkSendEnabled: boolean;
  pendingTtlMs: number;
  fromEmail?: string;
}

export class SendEmailService {
  constructor(
    private readonly pendingStore: PendingStore,
    private readonly bulkPendingStore: BulkPendingStore,
    private readonly recipientPolicy: RecipientPolicy,
    private readonly auditLogger: AuditLogger,
    private readonly gmailSender: GmailSender,
    private readonly authStatusProvider: AuthStatusProvider,
    private readonly options: SendEmailServiceOptions,
  ) {}

  async prepare(input: EmailDraftInput): Promise<PreparedSend> {
    const payload = canonicalizeEmailDraft(input);
    this.recipientPolicy.assertAllowed(allRecipients(payload));
    const digest = digestEmailPayload(payload);
    const record = await this.pendingStore.create(
      payload,
      digest,
      this.options.pendingTtlMs,
    );
    await this.auditLogger.record({
      action: "prepare",
      recipients: allRecipients(payload),
      subject: payload.subject,
      digest,
      result: "prepared",
    });
    return {
      pendingId: record.id,
      digest,
      preview: previewFor(record),
    };
  }

  async prepareBulk(input: { messages: EmailDraftInput[] }): Promise<PreparedBulkSend> {
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new SafeGmailError("At least one bulk email message is required.");
    }
    if (input.messages.length > MAX_BULK_MESSAGES) {
      throw new SafeGmailError(
        `Bulk send is limited to ${MAX_BULK_MESSAGES} messages per batch.`,
      );
    }

    const payloads = input.messages.map((message) => canonicalizeEmailDraft(message));
    for (const payload of payloads) {
      this.recipientPolicy.assertAllowed(allRecipients(payload));
    }
    const digest = digestBulkEmailPayloads(payloads);
    const record = await this.bulkPendingStore.create(
      payloads,
      digest,
      this.options.pendingTtlMs,
    );
    await this.auditLogger.record({
      action: "prepare_bulk",
      recipients: uniqueRecipients(payloads.flatMap((payload) => allRecipients(payload))),
      subject: bulkSubjectSummary(payloads),
      digest,
      result: "prepared",
    });
    return {
      pendingBulkId: record.id,
      digest,
      preview: bulkPreviewFor(record),
    };
  }

  async confirm(pendingId: string, digest: string): Promise<ConfirmSendResult> {
    let record: PendingSendRecord | undefined;
    try {
      record = await this.pendingStore.get(pendingId);
      if (!record) {
        throw new SafeGmailError("Pending send was not found.");
      }

      if (!this.options.sendEnabled) {
        throw new SafeGmailError(
          "Sending is disabled. Set SAFE_GMAIL_MCP_ENABLE_SEND=true to allow confirmed sends.",
        );
      }

      if (isExpired(record)) {
        await this.pendingStore.delete(record.id);
        await this.auditLogger.record({
          action: "expire",
          recipients: allRecipients(record.payload),
          subject: record.payload.subject,
          digest: record.digest,
          result: "expired",
        });
        throw new SafeGmailError("Pending send has expired.");
      }

      if (digest !== record.digest) {
        throw new SafeGmailError("Digest mismatch. Refusing to send email.");
      }

      if (!(await this.authStatusProvider.isAuthenticated())) {
        throw new SafeGmailError(
          "Gmail is not connected. Run 'safe-gmail-mcp auth'.",
        );
      }

      const raw = buildGmailRawMessage(record.payload, this.options.fromEmail);
      const result = await this.gmailSender.sendRaw(raw);
      await this.pendingStore.delete(record.id);
      await this.auditLogger.record({
        action: "confirm",
        recipients: allRecipients(record.payload),
        subject: record.payload.subject,
        digest: record.digest,
        result: "sent",
      });
      return { gmailMessageId: result.id };
    } catch (error) {
      if (record) {
        await this.auditLogger.record({
          action: "confirm",
          recipients: allRecipients(record.payload),
          subject: record.payload.subject,
          digest: record.digest,
          result: error instanceof SafeGmailError ? "refused" : "failed",
          errorSummary: publicErrorMessage(error),
        });
      }
      throw error;
    }
  }

  async confirmBulk(
    pendingBulkId: string,
    digest: string,
  ): Promise<ConfirmBulkSendResult> {
    let record: PendingBulkSendRecord | undefined;
    try {
      record = await this.bulkPendingStore.get(pendingBulkId);
      if (!record) {
        throw new SafeGmailError("Pending bulk send was not found.");
      }

      if (!this.options.sendEnabled) {
        throw new SafeGmailError(
          "Sending is disabled. Set SAFE_GMAIL_MCP_ENABLE_SEND=true to allow confirmed sends.",
        );
      }

      if (!this.options.bulkSendEnabled) {
        throw new SafeGmailError(
          "Bulk sending is disabled. Set SAFE_GMAIL_MCP_ENABLE_BULK_SEND=true to allow confirmed bulk sends.",
        );
      }

      if (isBulkExpired(record)) {
        await this.bulkPendingStore.delete(record.id);
        await this.auditLogger.record({
          action: "expire_bulk",
          recipients: uniqueRecipients(
            record.payloads.flatMap((payload) => allRecipients(payload)),
          ),
          subject: bulkSubjectSummary(record.payloads),
          digest: record.digest,
          result: "expired",
        });
        throw new SafeGmailError("Pending bulk send has expired.");
      }

      if (digest !== record.digest) {
        throw new SafeGmailError("Digest mismatch. Refusing to send bulk email.");
      }

      if (!(await this.authStatusProvider.isAuthenticated())) {
        throw new SafeGmailError(
          "Gmail is not connected. Run 'safe-gmail-mcp auth'.",
        );
      }

      const gmailMessageIds: string[] = [];
      for (const payload of record.payloads) {
        const raw = buildGmailRawMessage(payload, this.options.fromEmail);
        const result = await this.gmailSender.sendRaw(raw);
        gmailMessageIds.push(result.id);
      }
      await this.bulkPendingStore.delete(record.id);
      await this.auditLogger.record({
        action: "confirm_bulk",
        recipients: uniqueRecipients(
          record.payloads.flatMap((payload) => allRecipients(payload)),
        ),
        subject: bulkSubjectSummary(record.payloads),
        digest: record.digest,
        result: "sent",
      });
      return { gmailMessageIds, sentCount: gmailMessageIds.length };
    } catch (error) {
      if (record) {
        await this.auditLogger.record({
          action: "confirm_bulk",
          recipients: uniqueRecipients(
            record.payloads.flatMap((payload) => allRecipients(payload)),
          ),
          subject: bulkSubjectSummary(record.payloads),
          digest: record.digest,
          result: error instanceof SafeGmailError ? "refused" : "failed",
          errorSummary: publicErrorMessage(error),
        });
      }
      throw error;
    }
  }

  async listPending(): Promise<PendingSendSummary[]> {
    await this.pendingStore.pruneExpired();
    const records = await this.pendingStore.list();
    return records.map((record) => ({
      pendingId: record.id,
      recipients: allRecipients(record.payload),
      subject: record.payload.subject,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      digest: record.digest,
    }));
  }

  async listPendingBulk(): Promise<PendingBulkSendSummary[]> {
    await this.bulkPendingStore.pruneExpired();
    const records = await this.bulkPendingStore.list();
    return records.map((record) => ({
      pendingBulkId: record.id,
      messageCount: record.payloads.length,
      totalRecipientCount: record.payloads.reduce(
        (count, payload) => count + allRecipients(payload).length,
        0,
      ),
      recipients: uniqueRecipients(
        record.payloads.flatMap((payload) => allRecipients(payload)),
      ),
      subjects: record.payloads.map((payload) => payload.subject),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      digest: record.digest,
    }));
  }

  async discard(pendingId: string): Promise<{ discarded: boolean }> {
    const record = await this.pendingStore.get(pendingId);
    const discarded = await this.pendingStore.delete(pendingId);
    if (record) {
      await this.auditLogger.record({
        action: "discard",
        recipients: allRecipients(record.payload),
        subject: record.payload.subject,
        digest: record.digest,
        result: "discarded",
      });
    }
    return { discarded };
  }

  async discardBulk(pendingBulkId: string): Promise<{ discarded: boolean }> {
    const record = await this.bulkPendingStore.get(pendingBulkId);
    const discarded = await this.bulkPendingStore.delete(pendingBulkId);
    if (record) {
      await this.auditLogger.record({
        action: "discard_bulk",
        recipients: uniqueRecipients(
          record.payloads.flatMap((payload) => allRecipients(payload)),
        ),
        subject: bulkSubjectSummary(record.payloads),
        digest: record.digest,
        result: "discarded",
      });
    }
    return { discarded };
  }
}

function previewFor(record: PendingSendRecord): EmailPreview {
  return {
    to: record.payload.to,
    cc: record.payload.cc,
    bcc: record.payload.bcc,
    subject: record.payload.subject,
    bodyLength: record.payload.body.length,
    hasHtmlBody: record.payload.htmlBody !== null,
    expiresAt: record.expiresAt,
  };
}

function isExpired(record: PendingSendRecord, now = new Date()): boolean {
  return new Date(record.expiresAt).getTime() <= now.getTime();
}

function isBulkExpired(record: PendingBulkSendRecord, now = new Date()): boolean {
  return new Date(record.expiresAt).getTime() <= now.getTime();
}

function digestBulkEmailPayloads(payloads: Array<ReturnType<typeof canonicalizeEmailDraft>>): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        messages: payloads.map((payload) => JSON.parse(canonicalEmailJson(payload))),
      }),
      "utf8",
    )
    .digest("hex");
}

function bulkPreviewFor(record: PendingBulkSendRecord): PreparedBulkSend["preview"] {
  return {
    messageCount: record.payloads.length,
    totalRecipientCount: record.payloads.reduce(
      (count, payload) => count + allRecipients(payload).length,
      0,
    ),
    recipients: uniqueRecipients(
      record.payloads.flatMap((payload) => allRecipients(payload)),
    ),
    subjects: record.payloads.map((payload) => payload.subject),
    expiresAt: record.expiresAt,
  };
}

function uniqueRecipients(recipients: string[]): string[] {
  return [...new Set(recipients)].sort();
}

function bulkSubjectSummary(payloads: Array<ReturnType<typeof canonicalizeEmailDraft>>): string {
  const subjects = payloads.map((payload) => payload.subject);
  return subjects.length === 1
    ? subjects[0]
    : `${subjects.length} messages: ${subjects.slice(0, 3).join(" | ")}`;
}

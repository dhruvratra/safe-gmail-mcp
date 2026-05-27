import { AuthStatusProvider } from "../auth/authStatus.js";
import { SafeGmailError, publicErrorMessage } from "../errors.js";
import { GmailLabelManager } from "../gmail/read/gmailLabelManager.js";
import { GmailMessageLister } from "../gmail/read/gmailMessageLister.js";
import { GmailMessageReader } from "../gmail/read/gmailMessageReader.js";
import { EmailBodyResult, EmailHeaderSummary } from "../gmail/read/types.js";
import { ReadAuditLogger } from "./readAudit.js";

export class ReadEmailService {
  constructor(
    private readonly labels: GmailLabelManager,
    private readonly lister: GmailMessageLister,
    private readonly reader: GmailMessageReader,
    private readonly authStatusProvider: AuthStatusProvider,
    private readonly auditLogger: ReadAuditLogger,
  ) {}

  async listUnreadHeaders(maxResults?: number): Promise<EmailHeaderSummary[]> {
    try {
      await this.assertAuthenticated();
      const label = await this.labels.processedLabel();
      const messages = await this.lister.listUnreadUnprocessed(
        label.id,
        maxResults,
      );
      await this.auditLogger.record({
        action: "list_unread_headers",
        result: "returned",
      });
      return messages;
    } catch (error) {
      await this.auditLogger.record({
        action: "list_unread_headers",
        result: "failed",
        errorSummary: publicErrorMessage(error),
      });
      throw error;
    }
  }

  async readBody(messageId: string): Promise<EmailBodyResult> {
    try {
      await this.assertAuthenticated();
      const message = await this.reader.readBody(messageId);
      await this.auditLogger.record({
        action: "read_body",
        messageId,
        subject: message.subject,
        from: message.from,
        result: "labeled",
      });
      return message;
    } catch (error) {
      await this.auditLogger.record({
        action: "read_body",
        messageId,
        result: "failed",
        errorSummary: publicErrorMessage(error),
      });
      throw error;
    }
  }

  private async assertAuthenticated(): Promise<void> {
    if (!(await this.authStatusProvider.isAuthenticated())) {
      throw new SafeGmailError(
        "Gmail is not connected or needs reconnecting. Run 'safegmail connect'.",
      );
    }
  }
}

import { PROCESSED_LABEL_NAME } from "../../constants.js";
import { parseEmailBody } from "./gmailBodyParser.js";
import { summarizeMessage } from "./gmailHeaderParser.js";
import { GmailLabelManager } from "./gmailLabelManager.js";
import { GmailRequest } from "./gmailRequest.js";
import { EmailBodyResult, GmailMessageResponse } from "./types.js";

export class GmailMessageReader {
  constructor(
    private readonly request: GmailRequest,
    private readonly labelManager: GmailLabelManager,
  ) {}

  async readBody(messageId: string): Promise<EmailBodyResult> {
    const response = await this.request.get<GmailMessageResponse>(
      `messages/${encodeURIComponent(messageId)}`,
      new URLSearchParams({ format: "full" }),
    );
    const summary = summarizeMessage(response);
    const body = parseEmailBody(response.payload);
    await this.labelManager.applyProcessedLabel(messageId);
    return {
      ...summary,
      ...body,
      processedLabel: PROCESSED_LABEL_NAME,
    };
  }
}

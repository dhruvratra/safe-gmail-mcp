import { PROCESSED_LABEL_NAME } from "../../constants.js";
import { SafeGmailError } from "../../errors.js";
import { GmailRequest } from "./gmailRequest.js";

interface GmailLabel {
  id?: string;
  name?: string;
}

interface GmailLabelsResponse {
  labels?: GmailLabel[];
}

interface GmailLabelCreateResponse {
  id?: string;
}

export class GmailLabelManager {
  private processedLabelId?: string;

  constructor(private readonly request: GmailRequest) {}

  async processedLabel(): Promise<{ id: string; name: string }> {
    if (this.processedLabelId) {
      return { id: this.processedLabelId, name: PROCESSED_LABEL_NAME };
    }

    const existing = await this.findProcessedLabel();
    this.processedLabelId = existing ?? (await this.createProcessedLabel());
    return { id: this.processedLabelId, name: PROCESSED_LABEL_NAME };
  }

  async applyProcessedLabel(messageId: string): Promise<void> {
    const label = await this.processedLabel();
    await this.request.post(`messages/${encodeURIComponent(messageId)}/modify`, {
      addLabelIds: [label.id],
    });
  }

  private async findProcessedLabel(): Promise<string | undefined> {
    const response = await this.request.get<GmailLabelsResponse>("labels");
    return response.labels?.find((label) => label.name === PROCESSED_LABEL_NAME)?.id;
  }

  private async createProcessedLabel(): Promise<string> {
    const response = await this.request.post<GmailLabelCreateResponse>("labels", {
      name: PROCESSED_LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    });
    if (!response.id) {
      throw new SafeGmailError("Gmail label creation did not return a label ID.");
    }
    return response.id;
  }
}

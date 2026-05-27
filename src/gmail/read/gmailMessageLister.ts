import { DEFAULT_READ_MAX_RESULTS, MAX_READ_MAX_RESULTS } from "../../constants.js";
import { SafeGmailError } from "../../errors.js";
import { metadataHeaderParams, summarizeMessage } from "./gmailHeaderParser.js";
import { GmailRequest } from "./gmailRequest.js";
import { EmailHeaderSummary, GmailMessageResponse } from "./types.js";

interface GmailMessageListItem {
  id?: string;
  threadId?: string;
}

interface GmailMessageListResponse {
  messages?: GmailMessageListItem[];
  nextPageToken?: string;
}

export class GmailMessageLister {
  constructor(private readonly request: GmailRequest) {}

  async listUnreadUnprocessed(
    processedLabelId: string,
    maxResults = DEFAULT_READ_MAX_RESULTS,
  ): Promise<EmailHeaderSummary[]> {
    const limit = normalizeMaxResults(maxResults);
    const summaries: EmailHeaderSummary[] = [];
    let pageToken: string | undefined;

    do {
      const page = await this.listUnreadCandidates(limit, pageToken);
      pageToken = page.nextPageToken;

      for (const candidate of page.messages ?? []) {
        if (!candidate.id) {
          continue;
        }
        const summary = await this.getMetadata(candidate.id);
        if (!summary.labelIds.includes(processedLabelId)) {
          summaries.push(summary);
        }
        if (summaries.length >= limit) {
          break;
        }
      }
    } while (summaries.length < limit && pageToken);

    return summaries;
  }

  private async listUnreadCandidates(
    maxResults: number,
    pageToken?: string,
  ): Promise<GmailMessageListResponse> {
    const params = new URLSearchParams({
      maxResults: String(Math.min(maxResults * 2, 100)),
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }
    params.append("labelIds", "UNREAD");
    return this.request.get<GmailMessageListResponse>(
      "messages",
      params,
    );
  }

  private async getMetadata(messageId: string): Promise<EmailHeaderSummary> {
    const params = metadataHeaderParams();
    const response = await this.request.get<GmailMessageResponse>(
      `messages/${encodeURIComponent(messageId)}`,
      params,
    );
    return summarizeMessage(response);
  }
}

function normalizeMaxResults(value: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_READ_MAX_RESULTS) {
    throw new SafeGmailError(
      `maxResults must be an integer between 1 and ${MAX_READ_MAX_RESULTS}.`,
    );
  }
  return value;
}

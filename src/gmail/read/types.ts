export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePartBody {
  data?: string;
  attachmentId?: string;
  size?: number;
}

export interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

export interface GmailMessageResponse {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

export interface NormalizedEmailHeaders {
  from?: string;
  to: string[];
  cc: string[];
  subject?: string;
  date?: string;
  rfcMessageId?: string;
}

export interface EmailHeaderSummary extends NormalizedEmailHeaders {
  messageId: string;
  threadId?: string;
  snippet?: string;
  labelIds: string[];
  internalDate?: string;
}

export interface EmailBodyResult extends EmailHeaderSummary {
  textBody: string;
  htmlBody?: string;
  processedLabel: string;
}

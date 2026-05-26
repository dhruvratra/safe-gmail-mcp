export interface EmailDraftInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
}

export interface CanonicalEmailPayload {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  htmlBody: string | null;
}

export interface EmailPreview {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyLength: number;
  hasHtmlBody: boolean;
  expiresAt: string;
}

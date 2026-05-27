import { appendPrivateJsonLine } from "../storage/privateFiles.js";
import { StatePaths } from "../storage/paths.js";

export interface ReadAuditEntry {
  timestamp: string;
  action: "list_unread_headers" | "read_body";
  messageId?: string;
  subject?: string;
  from?: string;
  result: "returned" | "labeled" | "failed";
  errorSummary?: string;
}

export class ReadAuditLogger {
  constructor(private readonly paths: StatePaths) {}

  async record(entry: Omit<ReadAuditEntry, "timestamp">): Promise<void> {
    await appendPrivateJsonLine(this.paths.auditLogFile, {
      timestamp: new Date().toISOString(),
      ...entry,
      errorSummary: entry.errorSummary?.slice(0, 240),
    });
  }
}

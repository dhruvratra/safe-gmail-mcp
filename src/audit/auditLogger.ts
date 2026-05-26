import { appendPrivateJsonLine } from "../storage/privateFiles.js";
import { StatePaths } from "../storage/paths.js";

export interface AuditEntry {
  timestamp: string;
  action:
    | "prepare"
    | "confirm"
    | "discard"
    | "expire"
    | "prepare_bulk"
    | "confirm_bulk"
    | "discard_bulk"
    | "expire_bulk";
  recipients: string[];
  subject: string;
  digest?: string;
  result: "prepared" | "sent" | "discarded" | "expired" | "refused" | "failed";
  errorSummary?: string;
}

export class AuditLogger {
  constructor(private readonly paths: StatePaths) {}

  async record(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
    await appendPrivateJsonLine(this.paths.auditLogFile, {
      timestamp: new Date().toISOString(),
      ...entry,
      errorSummary: entry.errorSummary?.slice(0, 240),
    });
  }
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SafeGmailError } from "../errors.js";
import {
  ensurePrivateDir,
  readJsonFile,
  removeFileIfExists,
  writePrivateJson,
} from "../storage/privateFiles.js";
import { StatePaths } from "../storage/paths.js";
import { CanonicalEmailPayload } from "../email/types.js";

export interface PendingBulkSendRecord {
  id: string;
  payloads: CanonicalEmailPayload[];
  digest: string;
  createdAt: string;
  expiresAt: string;
}

export class BulkPendingStore {
  constructor(private readonly paths: StatePaths) {}

  async create(
    payloads: CanonicalEmailPayload[],
    digest: string,
    ttlMs: number,
    now = new Date(),
  ): Promise<PendingBulkSendRecord> {
    const record: PendingBulkSendRecord = {
      id: randomUUID(),
      payloads,
      digest,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    await this.save(record);
    return record;
  }

  async save(record: PendingBulkSendRecord): Promise<void> {
    assertBulkPendingId(record.id);
    await writePrivateJson(this.fileFor(record.id), record);
  }

  async get(id: string): Promise<PendingBulkSendRecord | undefined> {
    assertBulkPendingId(id);
    return readJsonFile<PendingBulkSendRecord>(this.fileFor(id));
  }

  async list(): Promise<PendingBulkSendRecord[]> {
    await ensurePrivateDir(this.bulkPendingDir);
    const entries = await fs.readdir(this.bulkPendingDir, { withFileTypes: true });
    const records: PendingBulkSendRecord[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      const id = entry.name.slice(0, -".json".length);
      if (!isBulkPendingId(id)) {
        continue;
      }
      const record = await this.get(id);
      if (record) {
        records.push(record);
      }
    }
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async delete(id: string): Promise<boolean> {
    assertBulkPendingId(id);
    return removeFileIfExists(this.fileFor(id));
  }

  async pruneExpired(now = new Date()): Promise<PendingBulkSendRecord[]> {
    const records = await this.list();
    const expired: PendingBulkSendRecord[] = [];
    for (const record of records) {
      if (new Date(record.expiresAt).getTime() <= now.getTime()) {
        await this.delete(record.id);
        expired.push(record);
      }
    }
    return expired;
  }

  private get bulkPendingDir(): string {
    return path.join(this.paths.rootDir, "pending-bulk");
  }

  private fileFor(id: string): string {
    assertBulkPendingId(id);
    return path.join(this.bulkPendingDir, `${id}.json`);
  }
}

export function assertBulkPendingId(id: string): void {
  if (!isBulkPendingId(id)) {
    throw new SafeGmailError("Invalid pending bulk send ID.");
  }
}

function isBulkPendingId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

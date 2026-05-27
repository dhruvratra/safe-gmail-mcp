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

export interface PendingSendRecord {
  id: string;
  payload: CanonicalEmailPayload;
  digest: string;
  createdAt: string;
  expiresAt: string;
}

export class PendingStore {
  constructor(private readonly paths: StatePaths) {}

  async create(
    payload: CanonicalEmailPayload,
    digest: string,
    ttlMs: number,
    now = new Date(),
  ): Promise<PendingSendRecord> {
    const record: PendingSendRecord = {
      id: randomUUID(),
      payload,
      digest,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    await this.save(record);
    return record;
  }

  async save(record: PendingSendRecord): Promise<void> {
    assertPendingId(record.id);
    await writePrivateJson(this.fileFor(record.id), record);
  }

  async get(id: string): Promise<PendingSendRecord | undefined> {
    assertPendingId(id);
    return readJsonFile<PendingSendRecord>(this.fileFor(id));
  }

  async list(): Promise<PendingSendRecord[]> {
    await ensurePrivateDir(this.paths.pendingDir);
    const entries = await fs.readdir(this.paths.pendingDir, { withFileTypes: true });
    const records: PendingSendRecord[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      const id = entry.name.slice(0, -".json".length);
      if (!isPendingId(id)) {
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
    assertPendingId(id);
    return removeFileIfExists(this.fileFor(id));
  }

  async pruneExpired(now = new Date()): Promise<PendingSendRecord[]> {
    const records = await this.list();
    const expired: PendingSendRecord[] = [];
    for (const record of records) {
      if (new Date(record.expiresAt).getTime() <= now.getTime()) {
        await this.delete(record.id);
        expired.push(record);
      }
    }
    return expired;
  }

  private fileFor(id: string): string {
    assertPendingId(id);
    return path.join(this.paths.pendingDir, `${id}.json`);
  }
}

export function assertPendingId(id: string): void {
  if (!isPendingId(id)) {
    throw new SafeGmailError("Invalid pending send ID.");
  }
}

function isPendingId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

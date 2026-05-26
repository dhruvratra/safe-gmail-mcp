import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export async function ensurePrivateDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
  await chmodIfSupported(dirPath, 0o700);
}

export async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function writePrivateJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensurePrivateDir(path.dirname(filePath));
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  const body = JSON.stringify(value, null, 2) + "\n";
  await fs.writeFile(tempPath, body, { mode: 0o600 });
  await chmodIfSupported(tempPath, 0o600);
  await fs.rename(tempPath, filePath);
  await chmodIfSupported(filePath, 0o600);
}

export async function appendPrivateJsonLine(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensurePrivateDir(path.dirname(filePath));
  const handle = await fs.open(filePath, "a", 0o600);
  try {
    await handle.write(JSON.stringify(value) + "\n");
  } finally {
    await handle.close();
  }
  await chmodIfSupported(filePath, 0o600);
}

export async function removeFileIfExists(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function removeDirIfExists(dirPath: string): Promise<boolean> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function chmodIfSupported(
  filePath: string,
  mode: number,
): Promise<void> {
  try {
    await fs.chmod(filePath, mode);
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

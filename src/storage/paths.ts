import os from "node:os";
import path from "node:path";

export class StatePaths {
  readonly rootDir: string;

  constructor(rootDir = path.join(os.homedir(), ".safe-gmail-mcp")) {
    this.rootDir = rootDir;
  }

  get configFile(): string {
    return path.join(this.rootDir, "config.json");
  }

  get tokenFile(): string {
    return path.join(this.rootDir, "tokens.json");
  }

  get pendingDir(): string {
    return path.join(this.rootDir, "pending");
  }

  get auditLogFile(): string {
    return path.join(this.rootDir, "audit.log");
  }

  display(filePath = this.rootDir): string {
    const home = os.homedir();
    return filePath.startsWith(home)
      ? "~" + filePath.slice(home.length)
      : filePath;
  }
}

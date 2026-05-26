import { spawn } from "node:child_process";

export async function openBrowser(url: string): Promise<boolean> {
  const command = browserCommand(url);
  if (!command) {
    return false;
  }

  return new Promise((resolve) => {
    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", () => resolve(false));
    child.on("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function browserCommand(url: string): { command: string; args: string[] } | undefined {
  if (process.platform === "darwin") {
    return { command: "open", args: [url] };
  }
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }
  return { command: "xdg-open", args: [url] };
}

#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execFile = promisify(execFileCallback);
const commandTimeoutMs = 60_000;
const mcpTimeoutMs = 15_000;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function run(command, args, options = {}) {
  return execFile(command, args, {
    timeout: commandTimeoutMs,
    ...options,
  });
}

async function withTimeout(promise, label, timeoutMs = mcpTimeoutMs) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "safe-gmail-mcp-smoke-"));
const npmEnv = {
  ...process.env,
  npm_config_cache:
    process.env.npm_config_cache ?? path.join(tmp, ".npm-cache"),
};
const { stdout } = await run("npm", [
  "pack",
  "--json",
  "--pack-destination",
  tmp,
], { cwd: projectRoot, env: npmEnv });

const [pack] = JSON.parse(stdout);
const tarball = path.join(tmp, pack.filename);
const includedPaths = pack.files.map((file) => file.path);
for (const entry of includedPaths) {
  const forbidden =
    entry === ".env" ||
    entry.startsWith(".env.") ||
    entry === "config.json" ||
    entry === "tokens.json" ||
    entry === "audit.log" ||
    entry === "pending" ||
    entry.startsWith("pending/") ||
    entry === "pending-bulk" ||
    entry.startsWith("pending-bulk/") ||
    entry.startsWith(".safe-gmail-mcp/");
  if (forbidden) {
    throw new Error(`Package unexpectedly includes local state: ${entry}`);
  }
}

await run("npm", [
  "install",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
  "--prefer-offline",
  tarball,
], { cwd: tmp, env: npmEnv });

const bin = path.join(
  tmp,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "safe-gmail-mcp.cmd" : "safe-gmail-mcp",
);
const help = await run(bin, ["--help"], { cwd: tmp });
if (!help.stdout.includes("safe-gmail-mcp serve")) {
  throw new Error("--help output did not include serve command");
}

const client = new Client({ name: "safe-gmail-mcp-smoke", version: "0.0.0" });
const transport = new StdioClientTransport({
  command: bin,
  args: ["serve"],
  env: {
    ...process.env,
    SAFE_GMAIL_MCP_ENABLE_SEND: "false",
    SAFE_GMAIL_MCP_ENABLE_BULK_SEND: "false",
  },
});
let tools;
try {
  await withTimeout(client.connect(transport), "MCP connect");
  tools = await withTimeout(client.listTools(), "MCP listTools");
} finally {
  await withTimeout(client.close(), "MCP client close").catch(() => {});
  await withTimeout(transport.close(), "MCP transport close").catch(() => {});
}

const expected = [
  "confirm_bulk_send",
  "confirm_send_email",
  "discard_pending_bulk_send",
  "discard_pending_send",
  "list_pending_bulk_sends",
  "list_pending_sends",
  "prepare_bulk_send",
  "prepare_send_email",
];
const actual = tools.tools.map((tool) => tool.name).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected MCP tools: ${actual.join(", ")}`);
}

const packageJson = JSON.parse(
  await readFile(path.join(tmp, "node_modules", "safe-gmail-mcp", "package.json"), "utf8"),
);
if (packageJson.scripts?.postinstall) {
  throw new Error("Package must not define a postinstall script");
}

console.log(`Smoke package OK: ${pack.filename}`);

import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createMcpServer } from "../dist/mcp/server.js";
import { expectedToolNames } from "../dist/mcp/tools.js";
import { tempPaths } from "./helpers.mjs";

test("expected tool registry contains only the public Gmail tools", () => {
  assert.deepEqual([...expectedToolNames()].sort(), [
    "confirm_bulk_send",
    "confirm_send_email",
    "discard_pending_bulk_send",
    "discard_pending_send",
    "list_pending_bulk_sends",
    "list_pending_sends",
    "list_unread_email_headers",
    "prepare_bulk_send",
    "prepare_send_email",
    "read_email_body",
  ]);
});

test("MCP server lists only expected tools", async () => {
  const paths = await tempPaths();
  const server = createMcpServer({
    paths,
    config: {
      allowedRecipients: [],
      blockedRecipients: [],
      pendingTtlMs: 10 * 60 * 1000,
    },
  });
  const client = new Client({ name: "safe-gmail-mcp-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = createTransportPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  await client.close();
  await server.close();

  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [...expectedToolNames()].sort(),
  );
});

class MemoryTransport {
  peer;
  onmessage;
  onclose;
  onerror;

  async start() {}

  async send(message) {
    queueMicrotask(() => this.peer?.onmessage?.(message));
  }

  async close() {
    this.onclose?.();
  }
}

function createTransportPair() {
  const a = new MemoryTransport();
  const b = new MemoryTransport();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

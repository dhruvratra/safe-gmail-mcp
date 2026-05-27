import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GmailLabelManager } from "../dist/gmail/read/gmailLabelManager.js";
import { GmailMessageLister } from "../dist/gmail/read/gmailMessageLister.js";
import { GmailMessageReader } from "../dist/gmail/read/gmailMessageReader.js";
import { ReadAuditLogger } from "../dist/read/readAudit.js";
import { ReadEmailService } from "../dist/read/readEmailService.js";
import { tempPaths } from "./helpers.mjs";

test("listUnreadHeaders returns headers and snippets without body content", async () => {
  const { service } = await makeReadService();

  const messages = await service.listUnreadHeaders(10);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, "m1");
  assert.equal(messages[0].from, "Friend <friend@example.com>");
  assert.equal(messages[0].subject, "Evening check-in");
  assert.equal(messages[0].snippet, "Short preview");
  assert.equal("textBody" in messages[0], false);
  assert.equal("htmlBody" in messages[0], false);
});

test("readBody returns one body and applies processed label without marking read", async () => {
  const { service, gmail } = await makeReadService();

  const message = await service.readBody("m1");

  assert.equal(message.textBody, "Hello from Gmail");
  assert.equal(message.htmlBody, "<p>Hello from Gmail</p>");
  assert.equal(message.processedLabel, "Safe Gmail MCP/Processed");
  assert.deepEqual(gmail.modifyCalls, [
    {
      path: "messages/m1/modify",
      body: { addLabelIds: ["Label_Processed"] },
    },
  ]);
  assert.deepEqual(gmail.messages.m1.labelIds.sort(), [
    "Label_Processed",
    "UNREAD",
  ]);
});

test("readBody creates processed label when missing", async () => {
  const { service, gmail } = await makeReadService({ labels: [] });

  const message = await service.readBody("m1");

  assert.equal(message.processedLabel, "Safe Gmail MCP/Processed");
  assert.equal(gmail.labels.length, 1);
  assert.equal(gmail.labels[0].name, "Safe Gmail MCP/Processed");
  assert.deepEqual(gmail.messages.m1.labelIds.sort(), [
    "Label_Created",
    "UNREAD",
  ]);
});

test("read tools refuse when Gmail is unauthenticated", async () => {
  const { service } = await makeReadService({ authenticated: false });

  await assert.rejects(
    () => service.listUnreadHeaders(10),
    /Gmail is not connected/,
  );
  await assert.rejects(
    () => service.readBody("m1"),
    /Gmail is not connected/,
  );
});

test("read audit log does not contain body content", async () => {
  const { service, paths } = await makeReadService();

  await service.readBody("m1");
  const audit = await readFile(paths.auditLogFile, "utf8");

  assert.match(audit, /read_body/);
  assert.doesNotMatch(audit, /Hello from Gmail/);
});

async function makeReadService(options = {}) {
  const paths = await tempPaths();
  const gmail = new MockGmailRequest(options);
  const labels = new GmailLabelManager(gmail);
  const service = new ReadEmailService(
    labels,
    new GmailMessageLister(gmail),
    new GmailMessageReader(gmail, labels),
    { isAuthenticated: async () => options.authenticated ?? true },
    new ReadAuditLogger(paths),
  );
  return { service, gmail, paths };
}

class MockGmailRequest {
  labels;
  messages;
  modifyCalls = [];

  constructor(options = {}) {
    this.labels = options.labels ?? [
      { id: "Label_Processed", name: "Safe Gmail MCP/Processed" },
    ];
    this.messages = {
      m1: messageFixture("m1", ["UNREAD"]),
      m2: messageFixture("m2", ["UNREAD", "Label_Processed"]),
    };
  }

  async get(path) {
    if (path === "labels") {
      return { labels: this.labels };
    }
    if (path === "messages") {
      return { messages: [{ id: "m1" }, { id: "m2" }] };
    }
    const match = path.match(/^messages\/(.+)$/);
    if (match) {
      return this.messages[decodeURIComponent(match[1])];
    }
    throw new Error(`Unexpected GET ${path}`);
  }

  async post(path, body) {
    if (path === "labels") {
      const label = { id: "Label_Created", name: body.name };
      this.labels.push(label);
      return label;
    }

    const match = path.match(/^messages\/(.+)\/modify$/);
    if (!match) {
      throw new Error(`Unexpected POST ${path}`);
    }
    this.modifyCalls.push({ path, body });
    const message = this.messages[decodeURIComponent(match[1])];
    message.labelIds = [...new Set([...message.labelIds, ...body.addLabelIds])];
    return {};
  }
}

function messageFixture(id, labelIds) {
  return {
    id,
    threadId: `thread-${id}`,
    labelIds,
    snippet: "Short preview",
    internalDate: "1700000000000",
    payload: {
      mimeType: "multipart/alternative",
      headers: [
        { name: "From", value: "Friend <friend@example.com>" },
        { name: "To", value: "Me <me@example.com>" },
        { name: "Subject", value: "Evening check-in" },
        { name: "Date", value: "Wed, 27 May 2026 19:00:00 +0530" },
      ],
      parts: [
        {
          mimeType: "text/plain",
          body: { data: Buffer.from("Hello from Gmail").toString("base64url") },
        },
        {
          mimeType: "text/html",
          body: {
            data: Buffer.from("<p>Hello from Gmail</p>").toString("base64url"),
          },
        },
      ],
    },
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import { makeService, validDraft } from "./helpers.mjs";

test("digest mismatch rejects without sending", async () => {
  const { service, gmail } = await makeService();
  const prepared = await service.prepare(validDraft());

  await assert.rejects(
    () => service.confirm(prepared.pendingId, "0".repeat(64)),
    /Digest mismatch/,
  );
  assert.equal(gmail.sent.length, 0);
});

test("pending send expiry deletes record and refuses", async () => {
  const { service, paths } = await makeService({ pendingTtlMs: -1 });
  const prepared = await service.prepare(validDraft());

  await assert.rejects(
    () => service.confirm(prepared.pendingId, prepared.digest),
    /expired/,
  );

  const pending = await service.listPending();
  assert.deepEqual(pending, []);
  assert.equal(paths.rootDir.includes(".safe-gmail-mcp"), false);
});

test("discard pending send deletes record", async () => {
  const { service } = await makeService();
  const prepared = await service.prepare(validDraft());

  assert.deepEqual(await service.discard(prepared.pendingId), { discarded: true });
  assert.deepEqual(await service.listPending(), []);
});

test("confirm refuses when sending env behavior is disabled", async () => {
  const { service, gmail } = await makeService({ sendEnabled: false });
  const prepared = await service.prepare(validDraft());

  await assert.rejects(
    () => service.confirm(prepared.pendingId, prepared.digest),
    /Sending is disabled/,
  );
  assert.equal(gmail.sent.length, 0);
});

test("confirm refuses when unauthenticated", async () => {
  const { service, gmail } = await makeService({ authenticated: false });
  const prepared = await service.prepare(validDraft());

  await assert.rejects(
    () => service.confirm(prepared.pendingId, prepared.digest),
    /Gmail is not connected/,
  );
  assert.equal(gmail.sent.length, 0);
});

test("confirm sends only after prepare and matching digest", async () => {
  const { service, gmail } = await makeService();
  const prepared = await service.prepare(validDraft());

  const result = await service.confirm(prepared.pendingId, prepared.digest);
  assert.equal(result.gmailMessageId, "mock-message-1");
  assert.equal(gmail.sent.length, 1);
  assert.deepEqual(await service.listPending(), []);
});

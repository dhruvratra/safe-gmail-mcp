import test from "node:test";
import assert from "node:assert/strict";
import { makeService, validDraft } from "./helpers.mjs";

function bulkMessages() {
  return [
    validDraft({
      to: ["one@example.com"],
      subject: "Bulk one",
      body: "Bulk body one",
    }),
    validDraft({
      to: ["two@example.com"],
      subject: "Bulk two",
      body: "Bulk body two",
    }),
  ];
}

test("prepareBulk stages a batch without exposing full bodies in list", async () => {
  const { service } = await makeService();
  const prepared = await service.prepareBulk({ messages: bulkMessages() });

  assert.equal(prepared.preview.messageCount, 2);
  assert.equal(prepared.preview.totalRecipientCount, 2);
  assert.deepEqual(prepared.preview.subjects, ["Bulk one", "Bulk two"]);

  const pending = await service.listPendingBulk();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].pendingBulkId, prepared.pendingBulkId);
  assert.equal("body" in pending[0], false);
});

test("confirmBulk refuses when bulk sending is disabled", async () => {
  const { service, gmail } = await makeService({ bulkSendEnabled: false });
  const prepared = await service.prepareBulk({ messages: bulkMessages() });

  await assert.rejects(
    () => service.confirmBulk(prepared.pendingBulkId, prepared.digest),
    /Bulk sending is disabled/,
  );
  assert.equal(gmail.sent.length, 0);
});

test("confirmBulk refuses when base sending is disabled", async () => {
  const { service, gmail } = await makeService({
    sendEnabled: false,
    bulkSendEnabled: true,
  });
  const prepared = await service.prepareBulk({ messages: bulkMessages() });

  await assert.rejects(
    () => service.confirmBulk(prepared.pendingBulkId, prepared.digest),
    /Sending is disabled/,
  );
  assert.equal(gmail.sent.length, 0);
});

test("confirmBulk rejects digest mismatch without sending", async () => {
  const { service, gmail } = await makeService();
  const prepared = await service.prepareBulk({ messages: bulkMessages() });

  await assert.rejects(
    () => service.confirmBulk(prepared.pendingBulkId, "0".repeat(64)),
    /Digest mismatch/,
  );
  assert.equal(gmail.sent.length, 0);
});

test("confirmBulk sends all messages after matching confirmation", async () => {
  const { service, gmail } = await makeService();
  const prepared = await service.prepareBulk({ messages: bulkMessages() });

  const result = await service.confirmBulk(prepared.pendingBulkId, prepared.digest);
  assert.deepEqual(result, {
    gmailMessageIds: ["mock-message-1", "mock-message-2"],
    sentCount: 2,
  });
  assert.equal(gmail.sent.length, 2);
  assert.deepEqual(await service.listPendingBulk(), []);
});

test("discardBulk deletes a pending batch", async () => {
  const { service } = await makeService();
  const prepared = await service.prepareBulk({ messages: bulkMessages() });

  assert.deepEqual(await service.discardBulk(prepared.pendingBulkId), {
    discarded: true,
  });
  assert.deepEqual(await service.listPendingBulk(), []);
});

test("expired bulk send is deleted and refused", async () => {
  const { service } = await makeService({ pendingTtlMs: -1 });
  const prepared = await service.prepareBulk({ messages: bulkMessages() });

  await assert.rejects(
    () => service.confirmBulk(prepared.pendingBulkId, prepared.digest),
    /expired/,
  );
  assert.deepEqual(await service.listPendingBulk(), []);
});

test("bulk send enforces a batch size limit", async () => {
  const { service } = await makeService();
  const messages = Array.from({ length: 26 }, (_, index) =>
    validDraft({
      to: [`person${index}@example.com`],
      subject: `Bulk ${index}`,
    }),
  );

  await assert.rejects(
    () => service.prepareBulk({ messages }),
    /limited to 25 messages/,
  );
});

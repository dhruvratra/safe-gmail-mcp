import test from "node:test";
import assert from "node:assert/strict";
import { RecipientPolicy } from "../dist/security/recipientPolicy.js";

test("allowlist exact email match permits one address", () => {
  const policy = new RecipientPolicy({
    allowedRecipients: ["person@example.com"],
    blockedRecipients: [],
  });
  assert.doesNotThrow(() => policy.assertAllowed(["person@example.com"]));
  assert.throws(() => policy.assertAllowed(["other@example.com"]), /allowlist/);
});

test("allowlist domain match permits addresses at that domain", () => {
  const policy = new RecipientPolicy({
    allowedRecipients: ["example.com"],
    blockedRecipients: [],
  });
  assert.doesNotThrow(() => policy.assertAllowed(["person@example.com"]));
  assert.throws(() => policy.assertAllowed(["person@sub.example.com"]), /allowlist/);
});

test("blocklist takes precedence over allowlist", () => {
  const policy = new RecipientPolicy({
    allowedRecipients: ["example.com"],
    blockedRecipients: ["bad@example.com"],
  });
  assert.throws(() => policy.assertAllowed(["bad@example.com"]), /blocked/);
});

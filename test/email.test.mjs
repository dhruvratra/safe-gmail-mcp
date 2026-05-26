import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeEmailDraft, digestEmailPayload } from "../dist/email/canonical.js";
import {
  normalizeEmailAddress,
  validateEmailDraft,
} from "../dist/email/validation.js";
import { buildRfc822Message } from "../dist/email/mime.js";

test("validates and normalizes email addresses", () => {
  assert.equal(normalizeEmailAddress(" Person@Example.COM "), "person@example.com");
  assert.throws(() => normalizeEmailAddress("not-an-email"), /Invalid email/);
});

test("rejects header injection in recipients and subject", () => {
  assert.throws(
    () =>
      validateEmailDraft({
        to: ["person@example.com\nbcc: other@example.com"],
        subject: "Hello",
        body: "Body",
      }),
    /CR or LF/,
  );
  assert.throws(
    () =>
      validateEmailDraft({
        to: ["person@example.com"],
        subject: "Hello\r\nBcc: other@example.com",
        body: "Body",
      }),
    /CR or LF/,
  );
});

test("canonical digest is stable for recipient order and case", () => {
  const first = canonicalizeEmailDraft({
    to: ["B@example.com", "a@example.com"],
    subject: "Hello",
    body: "Body",
  });
  const second = canonicalizeEmailDraft({
    to: ["A@example.com", "b@example.com"],
    subject: "Hello",
    body: "Body",
  });
  assert.deepEqual(first.to, ["a@example.com", "b@example.com"]);
  assert.equal(digestEmailPayload(first), digestEmailPayload(second));
});

test("builds plain text and HTML alternative messages", () => {
  const plain = buildRfc822Message(
    canonicalizeEmailDraft({
      to: ["person@example.com"],
      subject: "Hello",
      body: "Body",
    }),
    "sender@example.com",
  );
  assert.match(plain, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(plain, /From: <sender@example.com>/);

  const html = buildRfc822Message(
    canonicalizeEmailDraft({
      to: ["person@example.com"],
      subject: "Hello",
      body: "Plain",
      htmlBody: "<p>HTML</p>",
    }),
  );
  assert.match(html, /multipart\/alternative/);
  assert.match(html, /Content-Type: text\/html; charset=UTF-8/);
});

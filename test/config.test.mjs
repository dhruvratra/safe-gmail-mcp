import test from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import {
  ConfigLoader,
  normalizeGoogleClientId,
  normalizeGoogleClientSecret,
} from "../dist/config/config.js";
import { fetchDefaultOAuthClient } from "../dist/config/defaultOAuthClient.js";
import { tempPaths } from "./helpers.mjs";

test("normalizes Google OAuth client IDs", () => {
  assert.equal(
    normalizeGoogleClientId("  abc-123.apps.googleusercontent.com  "),
    "abc-123.apps.googleusercontent.com",
  );
  assert.throws(() => normalizeGoogleClientId("not-a-client-id"), /client ID/);
});

test("normalizes Google OAuth client secrets", () => {
  assert.equal(normalizeGoogleClientSecret("  GOCSPX-secret  "), "GOCSPX-secret");
  assert.throws(() => normalizeGoogleClientSecret("bad\nsecret"), /CR or LF/);
});

test("remote default Google OAuth credentials are the fallback", async () => {
  const paths = await tempPaths();
  const loader = new ConfigLoader(paths, async () => ({
    clientId: "default-client.apps.googleusercontent.com",
    clientSecret: "default-secret",
  }));

  const config = await loader.load();

  assert.equal(config.googleClientId, "default-client.apps.googleusercontent.com");
  assert.equal(config.googleClientIdSource, "default");
  assert.equal(config.googleClientSecret, "default-secret");
  assert.equal(config.googleClientSecretSource, "default");
});

test("default OAuth metadata accepts legacy scope text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        clientId: "default-client.apps.googleusercontent.com",
        clientSecret: "default-secret",
        scope: "https://www.googleapis.com/auth/gmail.send",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    assert.deepEqual(await fetchDefaultOAuthClient("https://example.test/oauth"), {
      clientId: "default-client.apps.googleusercontent.com",
      clientSecret: "default-secret",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test(
  "config setGoogleOAuthCredentials stores local config with 0600 permissions",
  { skip: process.platform === "win32" },
  async () => {
    const paths = await tempPaths();
    const loader = new ConfigLoader(paths);

    await loader.setGoogleOAuthCredentials(
      "abc-123.apps.googleusercontent.com",
      "GOCSPX-secret",
    );
    const config = await loader.load();
    const mode = (await stat(paths.configFile)).mode & 0o777;

    assert.equal(config.googleClientId, "abc-123.apps.googleusercontent.com");
    assert.equal(config.googleClientIdSource, "config");
    assert.equal(config.googleClientSecret, "GOCSPX-secret");
    assert.equal(config.googleClientSecretSource, "config");
    assert.equal(mode, 0o600);
  },
);

test("config deleteGoogleOAuthCredentials falls back to remote defaults", async () => {
  const paths = await tempPaths();
  const loader = new ConfigLoader(paths, async () => ({
    clientId: "default-client.apps.googleusercontent.com",
    clientSecret: "default-secret",
  }));

  await loader.setGoogleOAuthCredentials(
    "abc-123.apps.googleusercontent.com",
    "GOCSPX-secret",
  );
  await loader.deleteGoogleOAuthCredentials();
  const config = await loader.load();

  assert.equal(config.googleClientId, "default-client.apps.googleusercontent.com");
  assert.equal(config.googleClientIdSource, "default");
  assert.equal(config.googleClientSecret, "default-secret");
  assert.equal(config.googleClientSecretSource, "default");
});

import test from "node:test";
import assert from "node:assert/strict";
import { renderAuthLandingPage } from "../dist/auth/authServer.js";

test("auth UI uses one-click connect when default credentials are available", () => {
  const html = renderAuthLandingPage({
    clientId: "client.apps.googleusercontent.com",
    clientIdSource: "default",
    hasClientSecret: true,
    clientSecretSource: "default",
  });

  assert.match(html, /Connect Gmail/);
  assert.match(html, /Use my own Google OAuth app/);
  assert.doesNotMatch(html, /id="googleClientId"/);
  assert.doesNotMatch(html, /id="googleClientSecret"/);
});

test("auth UI shows saved OAuth app management when local credentials exist", () => {
  const html = renderAuthLandingPage({
    clientId: "client.apps.googleusercontent.com",
    clientIdSource: "config",
    hasClientSecret: true,
    clientSecretSource: "config",
    localClientId: "client.apps.googleusercontent.com",
    hasLocalClientSecret: true,
  });

  assert.match(html, /Saved OAuth app/);
  assert.match(html, /Change OAuth app/);
  assert.match(html, /Delete saved OAuth app and use default/);
});

test("auth UI shows BYO credential fields when requested", () => {
  const html = renderAuthLandingPage({
    clientId: "client.apps.googleusercontent.com",
    clientIdSource: "default",
    hasClientSecret: true,
    clientSecretSource: "default",
    useOwnApp: true,
  });

  assert.match(html, /id="googleClientId"/);
  assert.match(html, /id="googleClientSecret"/);
  assert.match(html, /\/oauth\/start\?mode=byo/);
  assert.match(html, /Use default Safe Gmail app/);
});

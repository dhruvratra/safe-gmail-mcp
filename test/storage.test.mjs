import test from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import { TokenStore } from "../dist/auth/tokenStore.js";
import { StatePaths } from "../dist/storage/paths.js";
import { tempPaths } from "./helpers.mjs";

test("default token file path stays outside repo", () => {
  const tokenFile = new StatePaths().tokenFile;
  const relative = path.relative(process.cwd(), tokenFile);
  assert.equal(relative.startsWith(".."), true);
});

test(
  "token file is written with 0600 permissions where supported",
  { skip: process.platform === "win32" },
  async () => {
    const paths = await tempPaths();
    const store = new TokenStore(paths);
    await store.saveFromGoogleResponse({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/gmail.send",
    });

    const mode = (await stat(paths.tokenFile)).mode & 0o777;
    assert.equal(mode, 0o600);
  },
);

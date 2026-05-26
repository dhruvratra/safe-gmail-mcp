import http from "node:http";
import { AddressInfo } from "node:net";
import { APP_NAME, GMAIL_SEND_SCOPE } from "../constants.js";
import { AuthError } from "../errors.js";
import {
  normalizeGoogleClientId,
  normalizeGoogleClientSecret,
} from "../config/config.js";
import { createPkcePair, createState } from "./pkce.js";
import { GoogleOAuthClient } from "./googleOAuth.js";
import { TokenStore } from "./tokenStore.js";
import { openBrowser } from "./browser.js";

export interface AuthPageState {
  clientId?: string;
  clientIdSource?: "env" | "config" | "default";
  clientSecret?: string;
  clientSecretSource?: "env" | "config" | "default";
  localClientId?: string;
  hasLocalClientSecret?: boolean;
}

export interface AuthServerOptions {
  initialClientId?: string;
  clientIdSource?: "env" | "config" | "default";
  initialClientSecret?: string;
  clientSecretSource?: "env" | "config" | "default";
  localClientId?: string;
  hasLocalClientSecret?: boolean;
  tokenStore: TokenStore;
  saveOAuthCredentials?: (
    clientId: string,
    clientSecret?: string,
  ) => Promise<void>;
  deleteOAuthCredentials?: () => Promise<void>;
  reloadOAuthState?: () => Promise<AuthPageState>;
  configFileDisplay?: string;
  stdout?: NodeJS.WritableStream;
}

interface PendingOAuthStart {
  state: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
}

export async function runAuthServer(options: AuthServerOptions): Promise<void> {
  let pending: PendingOAuthStart | undefined;
  let pageState = authPageStateFromOptions(options);
  let resolveFlow: (() => void) | undefined;
  let rejectFlow: ((error: Error) => void) | undefined;

  const complete = new Promise<void>((resolve, reject) => {
    resolveFlow = resolve;
    rejectFlow = reject;
  });

  const server = http.createServer(async (req, res) => {
    try {
      const baseUrl = serverBaseUrl(server);
      const requestUrl = new URL(req.url ?? "/", baseUrl);

      if (requestUrl.pathname === "/") {
        sendHtml(
          res,
          200,
          renderAuthLandingPage({
            clientId: pageState.clientId,
            clientIdSource: pageState.clientIdSource,
            hasClientSecret: Boolean(pageState.clientSecret),
            clientSecretSource: pageState.clientSecretSource,
            localClientId: pageState.localClientId,
            hasLocalClientSecret: pageState.hasLocalClientSecret,
            useOwnApp: requestUrl.searchParams.get("mode") === "byo",
            configFileDisplay: options.configFileDisplay,
          }),
        );
        return;
      }

      if (requestUrl.pathname === "/oauth/delete-local-app") {
        if (req.method !== "POST") {
          sendHtml(res, 405, page("Method not allowed."));
          return;
        }
        await options.deleteOAuthCredentials?.();
        pageState = options.reloadOAuthState
          ? await options.reloadOAuthState()
          : {
              ...pageState,
              localClientId: undefined,
              hasLocalClientSecret: false,
            };
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      if (requestUrl.pathname === "/oauth/start") {
        const credentials = await resolveCredentials(
          req,
          pageState,
          options,
          requestUrl.searchParams.get("mode") === "byo",
        );
        const pkce = createPkcePair();
        pending = {
          state: createState(),
          verifier: pkce.verifier,
          redirectUri: `${baseUrl}/oauth/callback`,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
        };
        const oauthClient = new GoogleOAuthClient(
          credentials.clientId,
          options.tokenStore,
          credentials.clientSecret,
        );
        const authorizationUrl = oauthClient.buildAuthorizationUrl({
          clientId: credentials.clientId,
          redirectUri: pending.redirectUri,
          state: pending.state,
          codeChallenge: pkce.challenge,
        });
        res.writeHead(302, { Location: authorizationUrl });
        res.end();
        return;
      }

      if (requestUrl.pathname === "/oauth/callback") {
        const error = requestUrl.searchParams.get("error");
        if (error) {
          throw new AuthError(`Google OAuth failed: ${error}`);
        }
        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");
        if (!pending || !code || state !== pending.state) {
          throw new AuthError("OAuth callback state did not match.");
        }
        const oauthClient = new GoogleOAuthClient(
          pending.clientId,
          options.tokenStore,
          pending.clientSecret,
        );
        await oauthClient.exchangeCode(
          code,
          pending.redirectUri,
          pending.verifier,
        );
        pending = undefined;
        sendHtml(
          res,
          200,
          page("Gmail connected. You can close this tab."),
        );
        server.close(() => resolveFlow?.());
        return;
      }

      sendHtml(res, 404, page("Not found."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "OAuth failed.";
      sendHtml(res, 400, page(escapeHtml(message)));
      server.close(() =>
        rejectFlow?.(error instanceof Error ? error : new Error(message)),
      );
    }
  });

  await listen(server);
  const url = serverBaseUrl(server);
  const opened = await openBrowser(url);
  const stdout = options.stdout ?? process.stdout;
  stdout.write(`Open this URL to connect Gmail:\n${url}\n`);
  if (!opened) {
    stdout.write("Could not open the browser automatically.\n");
  }

  return complete;
}

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function serverBaseUrl(server: http.Server): string {
  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new AuthError("Local OAuth server is not listening.");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function resolveCredentials(
  req: http.IncomingMessage,
  pageState: AuthPageState,
  options: AuthServerOptions,
  preferSubmittedCredentials: boolean,
): Promise<{ clientId: string; clientSecret?: string }> {
  if (
    !preferSubmittedCredentials &&
    pageState.clientId &&
    pageState.clientSecret
  ) {
    return {
      clientId: pageState.clientId,
      clientSecret: pageState.clientSecret,
    };
  }

  if (req.method !== "POST") {
    throw new AuthError("Google OAuth credentials are required before connecting.");
  }

  const form = await readForm(req);
  const submittedClientId = form.get("googleClientId");
  const submittedClientSecret = form.get("googleClientSecret");
  const clientId =
    preferSubmittedCredentials || !pageState.clientId
      ? submittedClientId
        ? normalizeGoogleClientId(submittedClientId)
        : undefined
      : pageState.clientId;
  if (!clientId) {
    throw new AuthError("Google OAuth client ID is required before connecting.");
  }

  const clientSecret =
    preferSubmittedCredentials || !pageState.clientSecret
      ? submittedClientSecret
        ? normalizeGoogleClientSecret(submittedClientSecret)
        : undefined
      : pageState.clientSecret;
  if (!clientSecret) {
    throw new AuthError(
      "Google OAuth client secret is required for Google Desktop app clients.",
    );
  }

  await options.saveOAuthCredentials?.(clientId, clientSecret);
  return { clientId, clientSecret };
}

function authPageStateFromOptions(options: AuthServerOptions): AuthPageState {
  return {
    clientId: options.initialClientId,
    clientIdSource: options.clientIdSource,
    clientSecret: options.initialClientSecret,
    clientSecretSource: options.clientSecretSource,
    localClientId: options.localClientId,
    hasLocalClientSecret: options.hasLocalClientSecret,
  };
}

export function renderAuthLandingPage(options: {
  clientId?: string;
  clientIdSource?: string;
  hasClientSecret?: boolean;
  clientSecretSource?: string;
  localClientId?: string;
  hasLocalClientSecret?: boolean;
  useOwnApp?: boolean;
  configFileDisplay?: string;
}): string {
  const useConfigured = Boolean(
    options.clientId && options.hasClientSecret && !options.useOwnApp,
  );
  const clientIdField = useConfigured
    ? `<p class="note">OAuth client ID configured from ${escapeHtml(options.clientIdSource ?? "local config")}.</p>
       <input name="googleClientId" type="hidden" value="${escapeHtml(options.clientId ?? "")}">`
    : `<label for="googleClientId">Google OAuth client ID</label>
       <input id="googleClientId" name="googleClientId" type="text" inputmode="text" spellcheck="false" autocomplete="off" placeholder="YOUR_CLIENT_ID.apps.googleusercontent.com" required>
       <p class="note">This will be saved locally to ${escapeHtml(options.configFileDisplay ?? "~/.safe-gmail-mcp/config.json")}.</p>`;
  const clientSecretField = useConfigured
    ? `<p class="note">OAuth client secret configured from ${escapeHtml(options.clientSecretSource ?? "local config")}.</p>`
    : `<label for="googleClientSecret">Google OAuth client secret</label>
       <input id="googleClientSecret" name="googleClientSecret" type="password" spellcheck="false" autocomplete="off" placeholder="GOCSPX-..." required>
       <p class="note">Google Desktop app clients often require this during token exchange. It is stored only on this machine.</p>`;
  const method = useConfigured ? "GET" : "POST";
  const action = options.useOwnApp ? "/oauth/start?mode=byo" : "/oauth/start";
  const ownAppLink = useConfigured
    ? `<p class="note"><a href="/?mode=byo">Use my own Google OAuth app</a></p>`
    : "";
  const sharedAppLink =
    options.useOwnApp && options.clientId && options.hasClientSecret
      ? `<p class="note"><a href="/">Use default Safe Gmail app</a></p>`
      : "";
  const credentialSummary =
    options.localClientId && !options.useOwnApp
      ? `<section class="panel">
          <h2>Saved OAuth app</h2>
          <p class="note">Using your saved Google OAuth app.</p>
          <dl>
            <dt>Client ID</dt>
            <dd><code>${escapeHtml(options.localClientId)}</code></dd>
            <dt>Client secret</dt>
            <dd><code>${options.hasLocalClientSecret ? "Saved locally" : "Not saved"}</code></dd>
          </dl>
          <div class="actions">
            <a href="/?mode=byo">Change OAuth app</a>
            <form class="inline" method="POST" action="/oauth/delete-local-app">
              <button class="link-button" type="submit">Delete saved OAuth app and use default</button>
            </form>
          </div>
        </section>`
      : "";
  return page(`
    <h1>${APP_NAME}</h1>
    <dl>
      <dt>Requested Gmail scope</dt>
      <dd><code>${GMAIL_SEND_SCOPE}</code></dd>
    </dl>
    <p class="note">This app can send email only after explicit MCP confirmation.</p>
    <form method="${method}" action="${action}">
      ${clientIdField}
      ${clientSecretField}
      <button type="submit">Connect Gmail</button>
    </form>
    ${ownAppLink}
    ${sharedAppLink}
    ${credentialSummary}
  `);
}

function page(content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${APP_NAME}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; color: #172026; background: #f7f8fa; }
    main { max-width: 720px; margin: 12vh auto; padding: 32px; background: #fff; border: 1px solid #d8dee4; border-radius: 8px; }
    h1 { margin-top: 0; font-size: 28px; }
    code { overflow-wrap: anywhere; }
    button { font: inherit; padding: 10px 16px; border-radius: 6px; border: 1px solid #0f5f9c; background: #126fb8; color: #fff; cursor: pointer; }
    a { color: #126fb8; }
    h2 { font-size: 18px; margin: 0 0 10px; }
    input { box-sizing: border-box; display: block; width: 100%; margin: 8px 0 12px; padding: 10px 12px; border: 1px solid #b9c2cc; border-radius: 6px; font: inherit; }
    label { display: block; margin-top: 18px; font-weight: 600; }
    .note { color: #45515c; }
    .panel { border-top: 1px solid #d8dee4; margin-top: 28px; padding-top: 20px; }
    .actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .inline { display: inline; }
    .link-button { padding: 0; border: 0; background: transparent; color: #126fb8; text-decoration: underline; }
    dt { font-weight: 600; margin-top: 16px; }
    dd { margin-left: 0; margin-top: 6px; }
  </style>
</head>
<body>
  <main>${content}</main>
</body>
</html>`;
}

async function readForm(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 16 * 1024) {
      throw new AuthError("Submitted form is too large.");
    }
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function sendHtml(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

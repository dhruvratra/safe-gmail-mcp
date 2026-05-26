import http from "node:http";
import { AddressInfo } from "node:net";
import { AuthError } from "../errors.js";
import {
  normalizeGoogleClientId,
  normalizeGoogleClientSecret,
} from "../config/config.js";
import { createPkcePair, createState } from "./pkce.js";
import { GoogleOAuthClient } from "./googleOAuth.js";
import { TokenStore } from "./tokenStore.js";
import { openBrowser } from "./browser.js";
import {
  renderAuthLandingPage,
  renderStatusPage,
} from "./authPage.js";
import type { AuthPageState, OAuthClientSource } from "./authTypes.js";

export interface AuthServerOptions {
  initialClientId?: string;
  clientIdSource?: OAuthClientSource;
  initialClientSecret?: string;
  clientSecretSource?: OAuthClientSource;
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
          sendHtml(res, 405, renderStatusPage("Method not allowed."));
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
          renderStatusPage("Gmail connected", "You can close this tab."),
        );
        server.close(() => resolveFlow?.());
        return;
      }

      sendHtml(res, 404, renderStatusPage("Not found."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "OAuth failed.";
      sendHtml(res, 400, renderStatusPage("Connection failed", message));
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

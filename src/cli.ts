#!/usr/bin/env node
import { ConfigLoader } from "./config/config.js";
import { APP_NAME, GMAIL_SEND_SCOPE, PACKAGE_NAME } from "./constants.js";
import { publicErrorMessage } from "./errors.js";
import { AuthPageState, runAuthServer } from "./auth/authServer.js";
import { TokenStore } from "./auth/tokenStore.js";
import { StatePaths } from "./storage/paths.js";
import { removeDirIfExists } from "./storage/privateFiles.js";
import { serveMcp } from "./mcp/server.js";

async function main(argv: string[]): Promise<void> {
  const [, , command, subcommand] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const paths = new StatePaths();
  const configLoader = new ConfigLoader(paths);

  if (command === "connect") {
    if (subcommand) {
      throw new Error(`Unknown connect command: ${subcommand}`);
    }
    await handleAuth(undefined, paths, configLoader);
    return;
  }

  if (command === "disconnect") {
    if (subcommand === "--all") {
      const removed = await removeDirIfExists(paths.rootDir);
      process.stdout.write(
        removed
          ? "Deleted all Safe Gmail MCP local state.\n"
          : "No Safe Gmail MCP local state found.\n",
      );
      return;
    }
    if (subcommand) {
      throw new Error(`Unknown disconnect command: ${subcommand}`);
    }
    await disconnectGmail(paths);
    return;
  }

  if (command === "auth") {
    await handleAuth(subcommand, paths, configLoader);
    return;
  }

  if (command === "serve") {
    const config = await configLoader.load();
    await serveMcp({ paths, config });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function handleAuth(
  subcommand: string | undefined,
  paths: StatePaths,
  configLoader: ConfigLoader,
): Promise<void> {
  const tokenStore = new TokenStore(paths);

  if (subcommand === "status") {
    const connected = await tokenStore.hasUsableTokens();
    process.stdout.write(
      connected
        ? `Gmail connected. Token file: ${tokenStore.tokenFileForDisplay()}\n`
        : "Gmail is not connected.\n",
    );
    return;
  }

  if (subcommand === "logout") {
    const deleted = await tokenStore.delete();
    process.stdout.write(
      deleted ? "Gmail tokens deleted.\n" : "No Gmail tokens found.\n",
    );
    return;
  }

  if (subcommand) {
    throw new Error(`Unknown auth command: ${subcommand}`);
  }

  const authPageState = await loadAuthPageState(configLoader);
  await runAuthServer({
    initialClientId: authPageState.clientId,
    clientIdSource: authPageState.clientIdSource,
    initialClientSecret: authPageState.clientSecret,
    clientSecretSource: authPageState.clientSecretSource,
    localClientId: authPageState.localClientId,
    hasLocalClientSecret: authPageState.hasLocalClientSecret,
    tokenStore,
    saveOAuthCredentials: (clientId, clientSecret) =>
      configLoader.setGoogleOAuthCredentials(clientId, clientSecret),
    deleteOAuthCredentials: () => configLoader.deleteGoogleOAuthCredentials(),
    reloadOAuthState: () => loadAuthPageState(configLoader),
    configFileDisplay: configLoader.configFileForDisplay(),
  });
}

async function loadAuthPageState(
  configLoader: ConfigLoader,
): Promise<AuthPageState> {
  const config = await configLoader.load();
  const localConfig = await configLoader.loadLocalConfig();
  return {
    clientId: config.googleClientId,
    clientIdSource: config.googleClientIdSource,
    clientSecret: config.googleClientSecret,
    clientSecretSource: config.googleClientSecretSource,
    localClientId: localConfig.googleClientId,
    hasLocalClientSecret: Boolean(localConfig.googleClientSecret),
  };
}

async function disconnectGmail(paths: StatePaths): Promise<void> {
  const tokenStore = new TokenStore(paths);
  const deleted = await tokenStore.delete();
  process.stdout.write(
    deleted ? "Gmail tokens deleted.\n" : "No Gmail tokens found.\n",
  );
}

function printHelp(): void {
  process.stdout.write(`${APP_NAME}

Usage:
  safegmail connect
  safegmail disconnect
  safegmail disconnect --all
  ${PACKAGE_NAME} auth
  ${PACKAGE_NAME} auth status
  ${PACKAGE_NAME} auth logout
  ${PACKAGE_NAME} serve
  ${PACKAGE_NAME} --help

Gmail scope:
  ${GMAIL_SEND_SCOPE}

Environment:
  SAFE_GMAIL_MCP_GOOGLE_CLIENT_ID   Google OAuth public/native client ID
  SAFE_GMAIL_MCP_GOOGLE_CLIENT_SECRET  Google OAuth desktop client secret
  SAFE_GMAIL_MCP_DEFAULT_OAUTH_URL  Default OAuth metadata endpoint
  SAFE_GMAIL_MCP_ENABLE_SEND=true   Allow confirm_send_email to send
  SAFE_GMAIL_MCP_ENABLE_BULK_SEND=true  Allow confirm_bulk_send to send

First-run auth:
  safegmail connect fetches the default OAuth app metadata when available.
  The local page also lets users view, change, or delete their own OAuth app.
`);
}

main(process.argv).catch((error) => {
  process.stderr.write(`${PACKAGE_NAME}: ${publicErrorMessage(error)}\n`);
  process.exitCode = 1;
});

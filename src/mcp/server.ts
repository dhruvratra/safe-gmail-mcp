import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "../constants.js";
import { GoogleOAuthClient } from "../auth/googleOAuth.js";
import { TokenAuthStatusProvider } from "../auth/authStatus.js";
import { TokenStore } from "../auth/tokenStore.js";
import { AuditLogger } from "../audit/auditLogger.js";
import { ResolvedConfig } from "../config/config.js";
import { GoogleGmailClient } from "../gmail/gmailClient.js";
import { GmailLabelManager } from "../gmail/read/gmailLabelManager.js";
import { GmailMessageLister } from "../gmail/read/gmailMessageLister.js";
import { GmailMessageReader } from "../gmail/read/gmailMessageReader.js";
import { GmailRequest } from "../gmail/read/gmailRequest.js";
import { BulkPendingStore } from "../pending/bulkPendingStore.js";
import { PendingStore } from "../pending/pendingStore.js";
import { ReadAuditLogger } from "../read/readAudit.js";
import { ReadEmailService } from "../read/readEmailService.js";
import { RecipientPolicy } from "../security/recipientPolicy.js";
import { SendEmailService } from "../services/sendEmailService.js";
import { StatePaths } from "../storage/paths.js";
import { registerReadTools } from "./readTools.js";
import { registerEmailTools } from "./tools.js";

export interface ServerFactoryOptions {
  paths: StatePaths;
  config: ResolvedConfig;
}

export function createMcpServer(options: ServerFactoryOptions): McpServer {
  const tokenStore = new TokenStore(options.paths);
  const oauthClient = new GoogleOAuthClient(
    options.config.googleClientId ?? "",
    tokenStore,
    options.config.googleClientSecret,
  );
  const authStatusProvider = new TokenAuthStatusProvider(tokenStore);
  const gmailRequest = new GmailRequest(oauthClient);
  const labelManager = new GmailLabelManager(gmailRequest);
  const service = new SendEmailService(
    new PendingStore(options.paths),
    new BulkPendingStore(options.paths),
    new RecipientPolicy({
      allowedRecipients: options.config.allowedRecipients,
      blockedRecipients: options.config.blockedRecipients,
    }),
    new AuditLogger(options.paths),
    new GoogleGmailClient(oauthClient),
    authStatusProvider,
    {
      sendEnabled: process.env.SAFE_GMAIL_MCP_ENABLE_SEND === "true",
      bulkSendEnabled: process.env.SAFE_GMAIL_MCP_ENABLE_BULK_SEND === "true",
      pendingTtlMs: options.config.pendingTtlMs,
      fromEmail: options.config.fromEmail,
    },
  );
  const readService = new ReadEmailService(
    labelManager,
    new GmailMessageLister(gmailRequest),
    new GmailMessageReader(gmailRequest, labelManager),
    authStatusProvider,
    new ReadAuditLogger(options.paths),
  );

  const server = new McpServer({
    name: "safe-gmail-mcp",
    version: VERSION,
  });
  registerEmailTools(server, service);
  registerReadTools(server, readService);
  return server;
}

export async function serveMcp(options: ServerFactoryOptions): Promise<void> {
  const server = createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

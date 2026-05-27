import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_READ_MAX_RESULTS } from "../constants.js";
import { ReadEmailService } from "../read/readEmailService.js";
import { errorResult, successResult } from "./toolResult.js";

export function registerReadTools(
  server: McpServer,
  service: ReadEmailService,
): void {
  server.registerTool(
    "list_unread_email_headers",
    {
      title: "List Unread Gmail Headers",
      description:
        "List unread, unprocessed Gmail messages with headers and snippets only. This does not return email bodies.",
      inputSchema: {
        maxResults: z.number().int().positive().optional(),
      },
    },
    async ({ maxResults = DEFAULT_READ_MAX_RESULTS }) => {
      try {
        return successResult({
          messages: await service.listUnreadHeaders(maxResults),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "read_email_body",
    {
      title: "Read Gmail Body",
      description:
        "Read the body for one Gmail message ID and then label it as processed by Safe Gmail MCP.",
      inputSchema: {
        messageId: z.string().min(1),
      },
    },
    async ({ messageId }) => {
      try {
        return successResult(await service.readBody(messageId));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

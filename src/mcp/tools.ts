import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EXPECTED_TOOL_NAMES, MAX_BULK_MESSAGES } from "../constants.js";
import { SendEmailService } from "../services/sendEmailService.js";
import { errorResult, successResult } from "./toolResult.js";

export function registerEmailTools(
  server: McpServer,
  service: SendEmailService,
): void {
  server.registerTool(
    "prepare_send_email",
    {
      title: "Prepare Gmail Send",
      description:
        "Validate and stage a Gmail send. This does not send email and returns a digest for explicit confirmation.",
      inputSchema: {
        to: z.array(z.string()).min(1),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string(),
        body: z.string(),
        htmlBody: z.string().optional(),
      },
    },
    async (input) => {
      try {
        return successResult(await service.prepare(input));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "confirm_send_email",
    {
      title: "Confirm Gmail Send",
      description:
        "Send a previously prepared email only when sending is enabled and the digest matches exactly.",
      inputSchema: {
        pendingId: z.string(),
        digest: z.string(),
      },
    },
    async ({ pendingId, digest }) => {
      try {
        return successResult(await service.confirm(pendingId, digest));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_pending_sends",
    {
      title: "List Pending Gmail Sends",
      description:
        "List pending email confirmations without showing full email bodies.",
      inputSchema: {},
    },
    async () => {
      try {
        return successResult({ pendingSends: await service.listPending() });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "discard_pending_send",
    {
      title: "Discard Pending Gmail Send",
      description: "Delete a pending email send without sending it.",
      inputSchema: {
        pendingId: z.string(),
      },
    },
    async ({ pendingId }) => {
      try {
        return successResult(await service.discard(pendingId));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "prepare_bulk_send",
    {
      title: "Prepare Bulk Gmail Send",
      description:
        "Validate and stage multiple Gmail sends as one batch. This does not send email and returns a batch digest for explicit confirmation.",
      inputSchema: {
        messages: z
          .array(
            z.object({
              to: z.array(z.string()).min(1),
              cc: z.array(z.string()).optional(),
              bcc: z.array(z.string()).optional(),
              subject: z.string(),
              body: z.string(),
              htmlBody: z.string().optional(),
            }),
          )
          .min(1)
          .max(MAX_BULK_MESSAGES),
      },
    },
    async (input) => {
      try {
        return successResult(await service.prepareBulk(input));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "confirm_bulk_send",
    {
      title: "Confirm Bulk Gmail Send",
      description:
        "Send a previously prepared email batch only when bulk sending is enabled and the digest matches exactly.",
      inputSchema: {
        pendingBulkId: z.string(),
        digest: z.string(),
      },
    },
    async ({ pendingBulkId, digest }) => {
      try {
        return successResult(await service.confirmBulk(pendingBulkId, digest));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_pending_bulk_sends",
    {
      title: "List Pending Bulk Gmail Sends",
      description:
        "List pending bulk email confirmations without showing full email bodies.",
      inputSchema: {},
    },
    async () => {
      try {
        return successResult({
          pendingBulkSends: await service.listPendingBulk(),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "discard_pending_bulk_send",
    {
      title: "Discard Pending Bulk Gmail Send",
      description: "Delete a pending bulk email send without sending it.",
      inputSchema: {
        pendingBulkId: z.string(),
      },
    },
    async ({ pendingBulkId }) => {
      try {
        return successResult(await service.discardBulk(pendingBulkId));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

export function expectedToolNames(): readonly string[] {
  return EXPECTED_TOOL_NAMES;
}

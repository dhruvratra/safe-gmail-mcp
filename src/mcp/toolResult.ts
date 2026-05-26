import { publicErrorMessage } from "../errors.js";

export interface McpTextResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function successResult(value: object): McpTextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

export function errorResult(error: unknown): McpTextResult {
  return {
    content: [{ type: "text", text: publicErrorMessage(error) }],
    isError: true,
  };
}

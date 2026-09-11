import { SetMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';
import type { McpPrincipal } from './mcp-principal';

export interface McpToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
}

export interface ToolDefinition<Args = unknown> {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodType<Args>;
  annotations: McpToolAnnotations;
  requiredScope: string;
  covers: readonly string[];
  handler: (principal: McpPrincipal, args: Args) => Promise<unknown>;
}

export interface McpToolProvider {
  tools(): ToolDefinition[];
}

export const MCP_TOOL_PROVIDER_KEY = 'mcp:tool-provider';

// Marks an injectable class whose tools() the registry collects at bootstrap. Register the class as an ordinary
// provider in any module — discovery finds it wherever it lives, so a server's tools stay in the server's own module.
export const McpTools = (): ClassDecorator => SetMetadata(MCP_TOOL_PROVIDER_KEY, true);

// Keeps the parsed argument type flowing into the handler while the registry stores every definition in one list
export function defineTool<Args>(definition: ToolDefinition<Args>): ToolDefinition {
  return definition as unknown as ToolDefinition;
}

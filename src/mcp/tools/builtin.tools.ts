import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MCP_SERVER_OPTIONS, type McpServerOptions } from '../mcp.options';
import { defineTool, type McpToolProvider, McpTools, type ToolDefinition } from '../tool-definition';

// The one tool every MCP server built on this module has: who the connection acts as
@Injectable()
@McpTools()
export class McpBuiltinTools implements McpToolProvider {
  constructor(@Inject(MCP_SERVER_OPTIONS) private readonly options: McpServerOptions) {}

  tools(): ToolDefinition[] {
    return [
      defineTool({
        name: 'whoami',
        title: 'Who am I',
        description:
          'Returns the user this connection acts as, the OAuth client and grant in use, the granted scopes, and the server version. Call it first to confirm access.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
        requiredScope: 'admin:read',
        handler: async (principal) => ({
          userId: principal.userId,
          grantId: principal.grantId,
          clientId: principal.clientId,
          scopes: principal.scopes,
          server: { name: this.options.name, version: this.options.version },
        }),
      }),
    ];
  }
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable } from '@nestjs/common';
import { MCP_SERVER_OPTIONS, type McpServerOptions } from './mcp.options';
import type { McpPrincipal } from './mcp-principal';
import { ToolRegistry } from './tool-registry';

// Builds the protocol server for one request, binding the two tool handlers to the caller's principal
@Injectable()
export class McpServerFactory {
  constructor(
    @Inject(MCP_SERVER_OPTIONS) private readonly options: McpServerOptions,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  create(principal: McpPrincipal): Server {
    const server = new Server(
      { name: this.options.name, version: this.options.version },
      { capabilities: { tools: {} }, instructions: this.options.instructions },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.toolRegistry.listTools() }));
    server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.toolRegistry.execute(request.params.name, request.params.arguments, principal),
    );
    return server;
  }
}

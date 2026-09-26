import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable } from '@nestjs/common';
import { MCP_SERVER_OPTIONS, type McpServerOptions } from './mcp.options';
import type { McpPrincipal } from './mcp-principal';
import { PromptRegistry } from './prompt-registry';
import { ToolRegistry } from './tool-registry';

// Builds the protocol server for one request, binding the tool, prompt and resource handlers to the caller's principal.
// Deliberately the low-level Server the SDK reserves for advanced use, not McpServer: registerTool only accepts a zod
// schema, and a DTO-backed tool's schema comes from the Swagger document so it cannot drift from its REST endpoint.
// The registries also validate DTO halves with class-validator and check scope in one place, which McpServer replaces.
@Injectable()
export class McpServerFactory {
  constructor(
    @Inject(MCP_SERVER_OPTIONS) private readonly options: McpServerOptions,
    private readonly toolRegistry: ToolRegistry,
    private readonly promptRegistry: PromptRegistry,
  ) {}

  create(principal: McpPrincipal): Server {
    // A capability is only advertised when something is registered under it, so a server with no prompts does not
    // invite a client to ask for a list it cannot answer
    const server = new Server(
      { name: this.options.name, version: this.options.version },
      {
        capabilities: {
          tools: {},
          ...(this.promptRegistry.hasPrompts() ? { prompts: {} } : {}),
          ...(this.promptRegistry.hasResources() ? { resources: {} } : {}),
        },
        instructions: this.options.instructions,
      },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.toolRegistry.listTools() }));
    server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.toolRegistry.execute(request.params.name, request.params.arguments, principal),
    );
    server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.promptRegistry.listPrompts(principal),
    }));
    server.setRequestHandler(GetPromptRequestSchema, async (request) =>
      this.promptRegistry.getPrompt(request.params.name, request.params.arguments, principal),
    );
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.promptRegistry.listResources(principal),
    }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
      this.promptRegistry.readResource(request.params.uri, principal),
    );
    return server;
  }
}

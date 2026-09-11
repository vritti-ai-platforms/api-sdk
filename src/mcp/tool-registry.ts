import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { Injectable, Logger, type OnApplicationBootstrap, type Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { z } from 'zod';
import type { McpPrincipal } from './mcp-principal';
import { MCP_TOOL_PROVIDER_KEY, type McpToolProvider, type ToolDefinition } from './tool-definition';
import { problemFromError, toolError, toolOk } from './tool-result';

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// Owns every tool the server exposes: collects @McpTools() providers at bootstrap, builds the tools/list catalog once,
// then runs each call through the same scope check, argument validation, error mapping and audit line so individual
// tools only implement their handler.
@Injectable()
export class ToolRegistry implements OnApplicationBootstrap {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly definitions = new Map<string, ToolDefinition>();
  private catalog: Tool[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  // After every module has initialised, so providers from any module are instantiated and discoverable
  onApplicationBootstrap(): void {
    for (const provider of this.findProviders()) {
      for (const definition of provider.tools()) this.register(definition);
    }
    this.catalog = [...this.definitions.values()].map((definition) => this.toCatalogEntry(definition));
    this.logger.log(`Registered ${this.catalog.length} MCP tools`);
  }

  listTools(): Tool[] {
    return this.catalog;
  }

  // Every REST operation the tools stand in for — a coverage test compares this with the live route set
  coveredOperationIds(): string[] {
    return [...this.definitions.values()].flatMap((definition) => [...definition.covers]);
  }

  async execute(name: string, rawArgs: unknown, principal: McpPrincipal): Promise<CallToolResult> {
    const started = Date.now();
    const definition = this.definitions.get(name);
    if (!definition) {
      return toolError({ status: 404, label: 'Unknown Tool', detail: `No tool named "${name}".`, errors: [] });
    }

    let status = 200;
    let result: CallToolResult;
    if (!principal.hasScope(definition.requiredScope)) {
      status = 403;
      result = toolError({
        status,
        label: 'Insufficient Scope',
        detail: `Tool "${name}" requires the ${definition.requiredScope} scope. Reconnect the client and grant it.`,
        errors: [],
      });
    } else {
      try {
        const args = definition.inputSchema.parse(rawArgs ?? {});
        result = toolOk(await definition.handler(principal, args));
      } catch (error) {
        const problem = problemFromError(error);
        status = problem.status;
        result = toolError(problem);
      }
    }

    this.logger.log(
      `mcp tool=${name} user=${principal.userId} grant=${principal.grantId ?? '-'} client=${principal.clientId ?? '-'} scope=${definition.requiredScope} ok=${status < 400} status=${status} ms=${Date.now() - started}`,
    );
    return result;
  }

  private findProviders(): McpToolProvider[] {
    return this.discovery
      .getProviders()
      .filter((wrapper) => typeof wrapper.metatype === 'function' && wrapper.instance)
      .filter(
        (wrapper) => this.reflector.get<boolean>(MCP_TOOL_PROVIDER_KEY, wrapper.metatype as Type<unknown>) === true,
      )
      .map((wrapper) => wrapper.instance as McpToolProvider);
  }

  private register(definition: ToolDefinition): void {
    if (!TOOL_NAME_PATTERN.test(definition.name)) {
      throw new Error(`MCP tool name "${definition.name}" is invalid (letters, digits, _ and -, max 64 chars).`);
    }
    if (this.definitions.has(definition.name)) {
      throw new Error(`MCP tool "${definition.name}" is registered twice.`);
    }
    this.definitions.set(definition.name, definition);
  }

  private toCatalogEntry(definition: ToolDefinition): Tool {
    return {
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: this.toInputSchema(definition),
      annotations: {
        title: definition.title,
        readOnlyHint: definition.annotations.readOnlyHint,
        destructiveHint: definition.annotations.destructiveHint,
        idempotentHint: definition.annotations.idempotentHint,
        openWorldHint: false,
      },
    };
  }

  // MCP wants a bare JSON Schema object at the root; zod adds a $schema marker the catalog does not need
  private toInputSchema(definition: ToolDefinition): Tool['inputSchema'] {
    const schema = z.toJSONSchema(definition.inputSchema, { io: 'input' }) as Record<string, unknown>;
    delete schema.$schema;
    if (schema.type !== 'object') {
      throw new Error(`MCP tool "${definition.name}" must declare an object input schema.`);
    }
    return schema as Tool['inputSchema'];
  }
}

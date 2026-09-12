import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { Injectable, Logger, type OnApplicationBootstrap, type Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { type ZodObject, z } from 'zod';
import type { McpPrincipal } from './mcp-principal';
import { McpSchemaRegistry } from './mcp-schema-registry';
import { MCP_TOOL_PROVIDER_KEY, type McpToolProvider, type ToolDefinition } from './tool-definition';
import { problemFromError, toolError, toolOk } from './tool-result';
import { validateDto } from './validate-dto';

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
type JsonSchema = Record<string, unknown>;

// Owns every tool the server exposes: collects @McpTools() providers at bootstrap, builds the tools/list catalog on
// first use (after the server has handed over its Swagger document, which DTO-backed tools draw their schemas from),
// then runs each call through the same scope check, argument validation, error mapping and audit line.
@Injectable()
export class ToolRegistry implements OnApplicationBootstrap {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly definitions = new Map<string, ToolDefinition>();
  private catalog?: Tool[];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly schemas: McpSchemaRegistry,
  ) {}

  // After every module has initialised, so providers from any module are instantiated and discoverable
  onApplicationBootstrap(): void {
    for (const provider of this.findProviders()) {
      for (const definition of provider.tools()) this.register(definition);
    }
    this.logger.log(`Registered ${this.definitions.size} MCP tools`);
  }

  listTools(): Tool[] {
    if (!this.catalog) {
      this.catalog = [...this.definitions.values()].map((definition) => this.toCatalogEntry(definition));
      const bytes = JSON.stringify(this.catalog).length;
      this.logger.log(`Built MCP tool catalog: ${this.catalog.length} tools, ${bytes} bytes`);
    }
    return this.catalog;
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
        const args = await this.parseArgs(definition, rawArgs);
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

  // A zod tool parses the whole input. A DTO-backed tool splits it: the envelope's own keys go to zod, everything
  // else is the request body, validated exactly as the REST endpoint would, and handed over as `data`.
  private async parseArgs(definition: ToolDefinition, rawArgs: unknown): Promise<unknown> {
    const input = (rawArgs ?? {}) as Record<string, unknown>;
    if (!definition.dto) return definition.inputSchema.parse(input);

    const envelopeKeys = new Set(Object.keys((definition.inputSchema as ZodObject).shape));
    const envelopeInput: Record<string, unknown> = {};
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (envelopeKeys.has(key)) envelopeInput[key] = value;
      else body[key] = value;
    }
    const envelope = definition.inputSchema.parse(envelopeInput) as Record<string, unknown>;
    const data = await validateDto(definition.dto, body);
    return { ...envelope, data };
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

  // MCP wants a bare JSON Schema object at the root; zod adds a $schema marker the catalog does not need. A DTO-backed
  // tool merges the REST DTO's documented schema with its envelope, so the model sees one flat object.
  private toInputSchema(definition: ToolDefinition): Tool['inputSchema'] {
    const envelope = z.toJSONSchema(definition.inputSchema, { io: 'input' }) as JsonSchema;
    delete envelope.$schema;
    if (envelope.type !== 'object') {
      throw new Error(`MCP tool "${definition.name}" must declare an object input schema.`);
    }
    if (!definition.dto) return envelope as Tool['inputSchema'];

    const dto = this.schemas.schemaFor(definition.dto);
    const dtoProperties = (dto.properties ?? {}) as Record<string, unknown>;
    const envelopeProperties = (envelope.properties ?? {}) as Record<string, unknown>;
    const overlap = Object.keys(envelopeProperties).filter((key) => key in dtoProperties);
    if (overlap.length > 0) {
      throw new Error(
        `MCP tool "${definition.name}": envelope and ${definition.dto.name} both define ${overlap.join(', ')}.`,
      );
    }
    const merged: JsonSchema = {
      type: 'object',
      properties: { ...dtoProperties, ...envelopeProperties },
      required: [
        ...((dto.required as string[] | undefined) ?? []),
        ...((envelope.required as string[] | undefined) ?? []),
      ],
    };
    if (dto.$defs) merged.$defs = dto.$defs;
    return merged as Tool['inputSchema'];
  }
}

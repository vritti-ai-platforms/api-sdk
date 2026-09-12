import { SetMetadata } from '@nestjs/common';
import type { ClassConstructor } from 'class-transformer';
import type { ZodObject, ZodRawShape, ZodType, z } from 'zod';
import type { McpPrincipal } from './mcp-principal';

export interface McpToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
}

// A tool whose whole input is a zod schema — lookups, deletes, workflows and anything with no REST DTO
export interface ToolDefinition<Args = unknown> {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodType<Args>;
  // Present on DTO-backed tools: the REST request class whose fields make up the rest of the input
  dto?: ClassConstructor<object>;
  annotations: McpToolAnnotations;
  requiredScope: string;
  handler: (principal: McpPrincipal, args: Args) => Promise<unknown>;
}

// A tool whose input is a REST request DTO plus a small envelope of MCP-only fields (parent ids, dryRun, confirm).
// The catalog shows the DTO's own JSON Schema merged with the envelope, so the fields can never drift from the REST
// API; a call validates the envelope with zod and the rest with the DTO's class-validator rules.
export interface DtoToolDefinition<Dto extends object, Envelope extends ZodRawShape> {
  name: string;
  title: string;
  description: string;
  dto: ClassConstructor<Dto>;
  envelope: ZodObject<Envelope>;
  annotations: McpToolAnnotations;
  requiredScope: string;
  handler: (principal: McpPrincipal, args: z.infer<ZodObject<Envelope>> & { data: Dto }) => Promise<unknown>;
}

export interface McpToolProvider {
  tools(): ToolDefinition[];
}

export const MCP_TOOL_PROVIDER_KEY = 'mcp:tool-provider';

// Marks an injectable class whose tools() the registry collects at bootstrap. Register the class as an ordinary
// provider in any module — discovery finds it wherever it lives, so a feature's tools stay in the feature's module.
export const McpTools = (): ClassDecorator => SetMetadata(MCP_TOOL_PROVIDER_KEY, true);

// Keeps the parsed argument type flowing into the handler while the registry stores every definition in one list
export function defineTool<Args>(definition: ToolDefinition<Args>): ToolDefinition {
  return definition as unknown as ToolDefinition;
}

// Same, for a DTO-backed tool: the envelope becomes the zod side, the DTO travels alongside for the registry
export function defineDtoTool<Dto extends object, Envelope extends ZodRawShape>(
  definition: DtoToolDefinition<Dto, Envelope>,
): ToolDefinition {
  const { dto, envelope, handler, ...rest } = definition;
  return { ...rest, inputSchema: envelope, dto, handler } as unknown as ToolDefinition;
}

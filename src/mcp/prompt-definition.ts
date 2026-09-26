import { SetMetadata } from '@nestjs/common';
import type { McpPrincipal } from './mcp-principal';

export const MCP_PROMPT_PROVIDER_KEY = 'mcp:prompt-provider';

// Marks a provider whose prompts() the registry collects at bootstrap, the same way @McpTools() works for tools
export const McpPrompts = (): ClassDecorator => SetMetadata(MCP_PROMPT_PROVIDER_KEY, true);

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

// A named recipe the client can pull in and fill. Tools say what the server can do; a prompt says how a whole task
// is done with them, which is the part an agent otherwise has to rediscover from tool descriptions alone.
export interface PromptDefinition {
  name: string;
  title: string;
  description: string;
  arguments?: PromptArgument[];
  requiredScope: string;
  render: (principal: McpPrincipal, args: Record<string, string>) => string | Promise<string>;
}

export interface McpPromptProvider {
  prompts(): PromptDefinition[];
}

export const MCP_RESOURCE_PROVIDER_KEY = 'mcp:resource-provider';

export const McpResources = (): ClassDecorator => SetMetadata(MCP_RESOURCE_PROVIDER_KEY, true);

// A document the client can read on demand — conventions, policies, anything a caller needs to get a write right but
// that would bloat every tool description if inlined there.
export interface ResourceDefinition {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  requiredScope: string;
  read: (principal: McpPrincipal) => string | Promise<string>;
}

export interface McpResourceProvider {
  resources(): ResourceDefinition[];
}

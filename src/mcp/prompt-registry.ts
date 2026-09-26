import { Injectable, Logger, type OnApplicationBootstrap, type Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { ForbiddenException, NotFoundException } from '../exceptions';
import type { McpPrincipal } from './mcp-principal';
import {
  MCP_PROMPT_PROVIDER_KEY,
  MCP_RESOURCE_PROVIDER_KEY,
  type McpPromptProvider,
  type McpResourceProvider,
  type PromptDefinition,
  type ResourceDefinition,
} from './prompt-definition';

// Owns the prompts and resources the server exposes, collected from @McpPrompts() / @McpResources() providers at
// bootstrap. Both are read-only and scope-checked like a tool call, so an unauthorised client sees neither.
@Injectable()
export class PromptRegistry implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromptRegistry.name);
  private readonly prompts = new Map<string, PromptDefinition>();
  private readonly resources = new Map<string, ResourceDefinition>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    for (const provider of this.findProviders<McpPromptProvider>(MCP_PROMPT_PROVIDER_KEY)) {
      for (const prompt of provider.prompts()) {
        if (this.prompts.has(prompt.name)) throw new Error(`MCP prompt "${prompt.name}" is registered twice.`);
        this.prompts.set(prompt.name, prompt);
      }
    }
    for (const provider of this.findProviders<McpResourceProvider>(MCP_RESOURCE_PROVIDER_KEY)) {
      for (const resource of provider.resources()) {
        if (this.resources.has(resource.uri)) throw new Error(`MCP resource "${resource.uri}" is registered twice.`);
        this.resources.set(resource.uri, resource);
      }
    }
    this.logger.log(`Registered ${this.prompts.size} MCP prompts and ${this.resources.size} MCP resources`);
  }

  hasPrompts(): boolean {
    return this.prompts.size > 0;
  }

  hasResources(): boolean {
    return this.resources.size > 0;
  }

  listPrompts(principal: McpPrincipal) {
    return [...this.prompts.values()]
      .filter((prompt) => principal.hasScope(prompt.requiredScope))
      .map((prompt) => ({
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        arguments: prompt.arguments ?? [],
      }));
  }

  async getPrompt(name: string, rawArgs: Record<string, string> | undefined, principal: McpPrincipal) {
    const prompt = this.prompts.get(name);
    if (!prompt) throw new NotFoundException(`No prompt named "${name}".`);
    this.assertScope(prompt.requiredScope, principal, `Prompt "${name}"`);
    const args = rawArgs ?? {};
    const missing = (prompt.arguments ?? [])
      .filter((argument) => argument.required && !args[argument.name])
      .map((argument) => argument.name);
    if (missing.length > 0) {
      throw new NotFoundException(`Prompt "${name}" needs ${missing.join(', ')}.`);
    }
    const text = await prompt.render(principal, args);
    this.logger.log(`mcp prompt=${name} user=${principal.userId}`);
    return {
      description: prompt.description,
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
    };
  }

  listResources(principal: McpPrincipal) {
    return [...this.resources.values()]
      .filter((resource) => principal.hasScope(resource.requiredScope))
      .map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        title: resource.title,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
  }

  async readResource(uri: string, principal: McpPrincipal) {
    const resource = this.resources.get(uri);
    if (!resource) throw new NotFoundException(`No resource at "${uri}".`);
    this.assertScope(resource.requiredScope, principal, `Resource "${uri}"`);
    const text = await resource.read(principal);
    this.logger.log(`mcp resource=${uri} user=${principal.userId}`);
    return { contents: [{ uri, mimeType: resource.mimeType, text }] };
  }

  private assertScope(requiredScope: string, principal: McpPrincipal, what: string): void {
    if (principal.hasScope(requiredScope)) return;
    throw new ForbiddenException(`${what} requires the ${requiredScope} scope. Reconnect the client and grant it.`);
  }

  private findProviders<T>(key: string): T[] {
    return this.discovery
      .getProviders()
      .filter((wrapper) => typeof wrapper.metatype === 'function' && wrapper.instance)
      .filter((wrapper) => this.reflector.get<boolean>(key, wrapper.metatype as Type<unknown>) === true)
      .map((wrapper) => wrapper.instance as T);
  }
}

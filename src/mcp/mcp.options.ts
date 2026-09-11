import type { McpPrincipalFactory } from './mcp-principal';

export const MCP_SERVER_OPTIONS = Symbol('MCP_SERVER_OPTIONS');

export interface McpServerOptions {
  name: string;
  version: string;
  instructions?: string;
}

export interface McpModuleOptions extends McpServerOptions {
  // How a request becomes a principal; defaults to the OAuth bearer the auth guard resolved
  principal?: McpPrincipalFactory;
}

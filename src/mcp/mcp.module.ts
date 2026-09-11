import { type DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MCP_SERVER_OPTIONS, type McpModuleOptions, type McpServerOptions } from './mcp.options';
import { MCP_PRINCIPAL_FACTORY, principalFromOAuth } from './mcp-principal';
import { McpRequestHandler } from './mcp-request.handler';
import { McpSchemaRegistry } from './mcp-schema-registry';
import { McpServerFactory } from './mcp-server.factory';
import { McpTransportFactory } from './mcp-transport.factory';
import { ToolRegistry } from './tool-registry';

// The MCP plumbing a server shares: transport, protocol server, request handler, schema registry and tool registry.
// The server keeps what is its own — the controller carrying the route and its @Require(), the @McpTools() providers,
// and whatever resource tables or workflows those tools compose.
@Module({})
export class McpModule {
  static forRoot(options: McpModuleOptions): DynamicModule {
    const serverOptions: McpServerOptions = {
      name: options.name,
      version: options.version,
      instructions: options.instructions,
    };
    return {
      module: McpModule,
      imports: [DiscoveryModule],
      providers: [
        { provide: MCP_SERVER_OPTIONS, useValue: serverOptions },
        { provide: MCP_PRINCIPAL_FACTORY, useValue: options.principal ?? principalFromOAuth },
        McpTransportFactory,
        McpServerFactory,
        McpRequestHandler,
        McpSchemaRegistry,
        ToolRegistry,
      ],
      exports: [McpRequestHandler, McpSchemaRegistry, ToolRegistry],
    };
  }
}

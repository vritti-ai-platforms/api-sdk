// Model Context Protocol plumbing for a NestJS + Fastify server: one stateless Streamable HTTP endpoint whose tools
// are discovered from @McpTools() providers and run through a shared scope, validation and error-mapping pipeline.

export { collectOperationIds } from './coverage';
export { McpModule } from './mcp.module';
export { MCP_SERVER_OPTIONS, type McpModuleOptions, type McpServerOptions } from './mcp.options';
export { MCP_PRINCIPAL_FACTORY, McpPrincipal, type McpPrincipalFactory, principalFromOAuth } from './mcp-principal';
export { McpRequestHandler } from './mcp-request.handler';
export { McpSchemaRegistry } from './mcp-schema-registry';
export { McpServerFactory } from './mcp-server.factory';
export { McpTransportFactory } from './mcp-transport.factory';
export {
  defineTool,
  MCP_TOOL_PROVIDER_KEY,
  type McpToolAnnotations,
  type McpToolProvider,
  McpTools,
  type ToolDefinition,
} from './tool-definition';
export { ToolRegistry } from './tool-registry';
export { problemFromError, type ToolFieldError, type ToolProblem, toolError, toolOk } from './tool-result';
export { McpValidationError, validateDto } from './validate-dto';

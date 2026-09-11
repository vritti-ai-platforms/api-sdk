import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { MCP_PRINCIPAL_FACTORY, type McpPrincipalFactory } from './mcp-principal';
import { McpServerFactory } from './mcp-server.factory';
import { McpTransportFactory } from './mcp-transport.factory';

// Runs one JSON-RPC exchange. The reply is hijacked so the MCP transport writes the raw response itself, and the
// already-parsed body is handed over because Fastify has consumed the request stream by the time a handler runs.
@Injectable()
export class McpRequestHandler {
  constructor(
    private readonly serverFactory: McpServerFactory,
    private readonly transportFactory: McpTransportFactory,
    @Inject(MCP_PRINCIPAL_FACTORY) private readonly principalFactory: McpPrincipalFactory,
  ) {}

  async handle(request: FastifyRequest, reply: FastifyReply, body: unknown): Promise<void> {
    const principal = this.principalFactory(request);
    reply.hijack();

    const transport = this.transportFactory.create();
    const server = this.serverFactory.create(principal);
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, body);
  }

  // The JSON-RPC answer for verbs a stateless server does not serve (GET streams, DELETE session teardown)
  methodNotAllowed(reply: FastifyReply): void {
    reply
      .status(405)
      .header('Allow', 'POST')
      .send({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  }
}

import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Transport types NestJS may report via host.getType(). Mirrors @nestjs/graphql's
// GqlContextType so transport literals are comparable without a hard dependency on it.
export type TransportType = 'http' | 'rpc' | 'ws' | 'graphql';

// Strategy for pulling the underlying Fastify request/response out of a NestJS ArgumentsHost
// (works for guards, interceptors, and exception filters). Adding a new API transport is a
// single new RequestExtractor + registerTransport() call — no other code changes.
export interface RequestExtractor {
  getRequest(host: ArgumentsHost): FastifyRequest;
  getResponse(host: ArgumentsHost): FastifyReply;
}

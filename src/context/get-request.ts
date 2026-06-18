import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { resolveExtractor } from './context.registry';

// Returns the underlying Fastify request for any registered transport (HTTP, GraphQL, ...).
// Resolves via the transport registry, so new transports need no change here or in callers.
export function getRequestFromContext(host: ArgumentsHost): FastifyRequest {
  return resolveExtractor(host.getType()).getRequest(host);
}

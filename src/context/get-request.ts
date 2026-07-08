import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { resolveExtractor } from './context.registry';

// Returns the underlying Fastify request for any registered transport, via the transport registry.
export function getRequestFromContext(host: ArgumentsHost): FastifyRequest {
  return resolveExtractor(host.getType()).getRequest(host);
}

import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { resolveExtractor } from './context.registry';

// Returns the underlying Fastify reply for any registered transport (HTTP, GraphQL, ...).
export function getResponseFromContext(host: ArgumentsHost): FastifyReply {
  return resolveExtractor(host.getType()).getResponse(host);
}

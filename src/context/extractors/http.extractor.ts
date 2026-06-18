import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RequestExtractor } from '../context.types';

// Default transport: standard HTTP via the Fastify adapter.
export const httpExtractor: RequestExtractor = {
  getRequest: (host) => host.switchToHttp().getRequest<FastifyRequest>(),
  getResponse: (host) => host.switchToHttp().getResponse<FastifyReply>(),
};

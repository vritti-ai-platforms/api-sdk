import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RequestExtractor } from '../context.types';

interface GqlContext {
  req: FastifyRequest;
  reply?: FastifyReply;
}

export const graphqlExtractor: RequestExtractor = {
  getRequest: (host: ArgumentsHost) => host.getArgByIndex<GqlContext>(2).req,
  getResponse: (host: ArgumentsHost) => host.getArgByIndex<GqlContext>(2).reply as FastifyReply,
};

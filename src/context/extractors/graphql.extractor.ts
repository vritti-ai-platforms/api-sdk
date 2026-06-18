import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RequestExtractor } from '../context.types';

// The GraphQL context is the 3rd resolver argument: (root, args, context, info). The core-server
// GraphQLModule sets `context: (request, reply) => ({ req: request, reply })`, so the host's
// arg #2 IS that `{ req, reply }` object. This is exactly what @nestjs/graphql's
// `GqlArgumentsHost.getContext()` returns internally — so we read it directly and avoid a runtime
// dependency on @nestjs/graphql. That matters: api-sdk is linked from OUTSIDE the consumer's
// node_modules tree, so `require('@nestjs/graphql')` from here cannot resolve the consumer's copy
// (it throws "Cannot find module '@nestjs/graphql'" at runtime).
interface GqlContext {
  req: FastifyRequest;
  reply?: FastifyReply;
}

export const graphqlExtractor: RequestExtractor = {
  getRequest: (host: ArgumentsHost) => host.getArgByIndex<GqlContext>(2).req,
  getResponse: (host: ArgumentsHost) => host.getArgByIndex<GqlContext>(2).reply as FastifyReply,
};

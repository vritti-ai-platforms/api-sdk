import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

// Extracts the bearer token from the Authorization header
export const AccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;
    return authHeader?.replace('Bearer ', '') || '';
  },
);

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import '../../types/fastify-augmentation';

// Extracts userId from request.sessionInfo (set by VrittiAuthGuard)
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const sessionInfo = request.sessionInfo;

    if (!sessionInfo?.userId) {
      throw new Error('User ID not found on request. Ensure route is protected by auth guard.');
    }

    return sessionInfo.userId;
  },
);

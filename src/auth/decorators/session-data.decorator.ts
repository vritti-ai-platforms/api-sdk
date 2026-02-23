import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import '../../types/fastify-augmentation';

export interface SessionInfo {
  userId: string;
  sessionId: string;
  sessionType: string;
}

// Returns full decoded session info from request.sessionInfo (set by VrittiAuthGuard)
export const SessionData = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionInfo => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const sessionInfo = request.sessionInfo;

    if (!sessionInfo?.sessionId) {
      throw new Error('Session info not found on request. Ensure route is protected by auth guard.');
    }

    return {
      userId: sessionInfo.userId,
      sessionId: sessionInfo.sessionId,
      sessionType: sessionInfo.sessionType,
    };
  },
);

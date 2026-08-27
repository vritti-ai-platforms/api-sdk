import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';
import '../../types/fastify-augmentation';

export interface SessionInfo {
  userId: string;
  sessionId: string;
  sessionType: string;
}

// Returns the session's own claims from request.auth (set by VrittiAuthGuard). Session-only,
// for the same reason as @UserId() — an app or cloud request has no session to describe.
export const SessionData = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionInfo => {
  const auth = getRequestFromContext(ctx).auth;

  if (auth?.kind !== 'session') {
    throw new Error(`No session on this request (auth: ${auth?.kind ?? 'none'}). @SessionData() is session-only.`);
  }

  return {
    userId: auth.userId,
    sessionId: auth.sessionId,
    sessionType: auth.sessionType,
  };
});

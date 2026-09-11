import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';
import '../../types/fastify-augmentation';

// Extracts userId from request.auth (set by VrittiAuthGuard).
//
// A session has one, and so does an OAuth bearer token once the server has resolved whom it was granted to.
// An app request acts for a credential and a cloud request for the control plane, so asking for a user on
// either is a mistake at the call site — it throws rather than returning a stand-in that would be recorded
// as if a person had acted.
export const UserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const auth = getRequestFromContext(ctx).auth;

  if (auth?.kind === 'session') return auth.userId;
  if (auth?.kind === 'oauth' && auth.userId) return auth.userId;

  throw new Error(
    `No user on this request (auth: ${auth?.kind ?? 'none'}). @UserId() needs a session or an OAuth bearer.`,
  );
});

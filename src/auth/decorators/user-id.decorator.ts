import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';
import '../../types/fastify-augmentation';

// Extracts userId from request.auth (set by VrittiAuthGuard).
//
// Only a session has one. An app request acts for a credential and a cloud request for the
// control plane, so asking for a user on either is a mistake at the call site — it throws
// rather than returning a stand-in that would be recorded as if a person had acted.
export const UserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const auth = getRequestFromContext(ctx).auth;

  if (auth?.kind !== 'session') {
    throw new Error(`No user on this request (auth: ${auth?.kind ?? 'none'}). @UserId() is session-only.`);
  }

  return auth.userId;
});

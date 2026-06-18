import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';

// Extracts the bearer token from the Authorization header
export const AccessToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = getRequestFromContext(ctx);
  const authHeader = request.headers.authorization;
  return authHeader?.replace('Bearer ', '') || '';
});

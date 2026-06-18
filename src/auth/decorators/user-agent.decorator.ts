import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';

// Extracts the User-Agent header from the request, working across HTTP and GraphQL transports
export const UserAgent = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const userAgent = getRequestFromContext(ctx).headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
});

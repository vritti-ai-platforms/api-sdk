import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';

// Extracts the client IP from the request, working across HTTP and GraphQL transports
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return getRequestFromContext(ctx).ip;
});

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';

// Extracts the request hostname from x-forwarded-host (set by reverse proxies and dev proxy) with fallback to request.hostname
export const Hostname = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = getRequestFromContext(ctx);
  const forwarded = request.headers['x-forwarded-host'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const hostStr = raw ?? request.hostname;
  return hostStr.split(':')[0] ?? hostStr;
});

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';

// Extracts the subdomain from the request host, resolved the same way as @Hostname() — x-forwarded-host
// (set by dev and reverse proxies) with a fallback to request.hostname. Origin is deliberately not used:
// it is client-controlled and can disagree with the Host header, which would mint a session for one
// subdomain that the auth guard's host check then rejects against another.
export const Subdomain = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = getRequestFromContext(ctx);

  const forwarded = request.headers['x-forwarded-host'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const hostStr = raw ?? request.hostname;
  if (!hostStr) return undefined;

  const host = hostStr.split(':')[0] ?? hostStr;
  return host.split('.')[0] || undefined;
});

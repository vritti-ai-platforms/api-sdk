import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

// Extracts the subdomain from the request's origin or x-forwarded-host header
export const Subdomain = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();

  // Try origin header first (browser always sends this on cross-origin requests)
  const origin = request.headers.origin;
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname.split('.')[0];
    } catch {
      // Invalid origin, fall through
    }
  }

  // Fallback to x-forwarded-host (set by rsbuild proxy and production reverse proxies)
  const forwarded = request.headers['x-forwarded-host'];
  const host = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (host) return host.split('.')[0];

  return undefined;
});

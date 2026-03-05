import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { type CookieSerializeOptions, getRefreshCookieOptionsForHost } from '../../config';

// Returns refresh cookie options with domain scoped to the request subdomain (reads x-forwarded-host injected by proxy)
export const RefreshCookieOptions = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CookieSerializeOptions => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const forwarded = request.headers['x-forwarded-host'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const hostStr = raw ?? request.hostname;
    const domain = hostStr.split(':')[0] ?? hostStr;
    return getRefreshCookieOptionsForHost(domain);
  },
);

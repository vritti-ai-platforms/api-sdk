import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { getConfig } from '../../config';

// Extracts the cookie domain from x-forwarded-host (injected by proxy), validated against baseDomain, falls back to baseDomain if invalid
export const CookieDomain = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const forwarded = request.headers['x-forwarded-host'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const hostStr = raw ?? request.hostname;
    const domain = hostStr.split(':')[0] ?? hostStr;
    const baseDomain = getConfig().cookie.refreshCookieDomain ?? '';
    return domain.endsWith(`.${baseDomain}`) ? domain : baseDomain;
  },
);

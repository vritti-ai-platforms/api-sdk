import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONFIG_DEFAULTS } from '../auth.config';

// Returns the configured refresh cookie name from request.authConfig
export const CookieName = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  return request.authConfig?.cookie.refreshCookieName ?? AUTH_CONFIG_DEFAULTS.cookie.refreshCookieName;
});

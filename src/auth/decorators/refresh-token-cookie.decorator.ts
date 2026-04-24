import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONFIG_DEFAULTS } from '../auth.config';

export const RefreshTokenCookie = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  const cookies = request.cookies ?? {};
  const cookieName = request.authConfig?.cookie.refreshCookieName ?? AUTH_CONFIG_DEFAULTS.cookie.refreshCookieName;
  return cookies[cookieName] as string | undefined;
});

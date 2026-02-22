import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { getConfig } from '../../config';

export const RefreshTokenCookie = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const cookies = (request as any).cookies || {};
    const config = getConfig();
    return cookies[config.cookie.refreshCookieName] as string | undefined;
  },
);

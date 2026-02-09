import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { getConfig } from '../../config';

/**
 * Parameter decorator that extracts the refresh token from the httpOnly cookie.
 * Returns undefined if no cookie is present — the consumer decides how to handle missing values.
 *
 * Uses `getConfig().cookie.refreshCookieName` for the cookie name, consistent
 * with VrittiAuthGuard and RequestService.
 *
 * @example
 * ```typescript
 * @Get('token')
 * @Public()
 * async getToken(@RefreshTokenCookie() refreshToken: string | undefined) {
 *   return this.sessionService.recoverSession(refreshToken);
 * }
 * ```
 */
export const RefreshTokenCookie = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const cookies = (request as any).cookies || {};
    const config = getConfig();
    return cookies[config.cookie.refreshCookieName] as string | undefined;
  },
);

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../../context';
import { AUTH_CONFIG_DEFAULTS } from '../auth.config';

export const RefreshTokenCookie = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = getRequestFromContext(ctx);
  const cookies = request.cookies ?? {};
  const cookieName = request.authConfig?.cookie.refreshCookieName ?? AUTH_CONFIG_DEFAULTS.cookie.refreshCookieName;
  return cookies[cookieName] as string | undefined;
});

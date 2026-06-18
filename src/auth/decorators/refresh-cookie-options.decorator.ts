import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '../../exceptions';
import { getRequestFromContext } from '../../context';
import { AUTH_CONFIG_DEFAULTS, type CookieConfig, type CookieSerializeOptions } from '../auth.config';

// Builds cookie serialize options from the given cookie config
function buildCookieOptionsForHost(cookieConfig: CookieConfig, hostname: string): CookieSerializeOptions {
  const baseDomain = cookieConfig.refreshCookieDomain;

  if (!baseDomain) {
    throw new Error('refreshCookieDomain must be configured before using @RefreshCookieOptions()');
  }

  if (!hostname.endsWith(`.${baseDomain}`)) {
    throw new UnauthorizedException('Invalid request host.');
  }

  return {
    httpOnly: true,
    secure: cookieConfig.refreshCookieSecure,
    sameSite: cookieConfig.refreshCookieSameSite,
    path: cookieConfig.refreshCookiePath,
    maxAge: cookieConfig.refreshCookieMaxAge,
    domain: hostname,
  };
}

// Returns refresh cookie options with domain scoped to the request subdomain (reads x-forwarded-host injected by proxy)
export const RefreshCookieOptions = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CookieSerializeOptions => {
    const request = getRequestFromContext(ctx);
    const forwarded = request.headers['x-forwarded-host'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const hostStr = raw ?? request.hostname;
    const domain = hostStr.split(':')[0] ?? hostStr;
    const cookieConfig: CookieConfig = request.authConfig?.cookie ?? AUTH_CONFIG_DEFAULTS.cookie;
    return buildCookieOptionsForHost(cookieConfig, domain);
  },
);

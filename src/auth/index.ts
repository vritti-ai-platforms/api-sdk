// Token types and config
export {
  type AccessTokenPayload,
  AUTH_CONFIG,
  AUTH_CONFIG_DEFAULTS,
  type AuthConfig,
  type CookieConfig,
  type DecodedAccessToken,
  type DecodedRefreshToken,
  type GuardConfig,
  type RefreshTokenPayload,
  type TokenExpiry,
  type TokenExpiryString,
  TokenType,
} from './auth.config';
export * from './auth-config.module';
export * from './decorators/access-token.decorator';
export * from './decorators/cookie-domain.decorator';
export * from './decorators/cookie-name.decorator';
export * from './decorators/hostname.decorator';
export * from './decorators/public.decorator';
export * from './decorators/refresh-cookie-options.decorator';
export * from './decorators/refresh-token-cookie.decorator';
export * from './decorators/require-session.decorator';
export type { SessionInfo } from './decorators/session-data.decorator';
export { SessionData } from './decorators/session-data.decorator';
export * from './decorators/subdomain.decorator';
export * from './decorators/user-id.decorator';
export * from './guards/vritti-auth.guard';
// Token service — generation, validation, and binding verification
export { TokenService } from './services/token.service';

// Token hash utilities
export { hashToken, verifyTokenHash } from './utils/token-hash.util';

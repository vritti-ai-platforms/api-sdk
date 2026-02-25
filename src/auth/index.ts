export * from './auth-config.module';
export * from './decorators/access-token.decorator';
export * from './decorators/onboarding.decorator';
export * from './decorators/public.decorator';
export * from './decorators/refresh-token-cookie.decorator';
export * from './decorators/reset.decorator';
export type { SessionInfo } from './decorators/session-data.decorator';
export { SessionData } from './decorators/session-data.decorator';
export * from './decorators/user-id.decorator';
export * from './guards/vritti-auth.guard';

// JWT config utilities
export {
  getTokenExpiry,
  jwtConfigFactory,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type TokenExpiry,
  TokenType,
} from './jwt.config';

// JWT auth service
export { JwtAuthService } from './services/jwt-auth.service';

// Token hash utilities
export { hashToken, verifyTokenHash } from './utils/token-hash.util';

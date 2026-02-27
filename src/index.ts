import './types/fastify-augmentation';

// Config system

// Auth (decorators, guards, token utilities)
export * from './auth';
// Auth decorators (SkipCsrf for webhook endpoints)
export { SKIP_CSRF_KEY, SkipCsrf } from './auth/decorators/skip-csrf.decorator';
// JWT config utilities
export {
  getTokenExpiry,
  jwtConfigFactory,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type TokenExpiry,
  TokenType,
} from './auth/jwt.config';
// JWT auth service
export { JwtAuthService } from './auth/services/jwt-auth.service';
export {
  type ApiSdkConfig,
  type CookieConfig,
  configureApiSdk,
  defineConfig,
  getConfig,
  getJwtExpiry,
  getRefreshCookieOptions,
  type GuardConfig,
  type JwtConfig,
  resetConfig,
} from './config';
export { DatabaseModule } from './database/database.module';
// Decorators
export { Tenant } from './database/decorators/tenant.decorator';
// Database DTOs
export { SelectOptionsQueryDto } from './database/dto/select-options-query.dto';
// Interfaces
export * from './database/interfaces';
// Repositories
export { PrimaryBaseRepository } from './database/repositories/primary-base.repository';
export { TenantBaseRepository } from './database/repositories/tenant-base.repository';
// Schema Registry (for module augmentation)
export type {
  RegisteredSchema,
  TypedDrizzleClient,
} from './database/schema.registry';
export { PrimaryDatabaseService } from './database/services/primary-database.service';
// Services
export { TenantContextService } from './database/services/tenant-context.service';
export { TenantDatabaseService } from './database/services/tenant-database.service';
// Database types
export type {
  FindForSelectConfig,
  FindForSelectJoin,
  SelectQueryGroup,
  SelectQueryOption,
  SelectQueryResult,
} from './database/types';
// Email module
export { EmailModule } from './email/email.module';
export { EmailService } from './email/email.service';
// Exceptions
export * from './exceptions';
// RFC 7807 Filters (includes HttpExceptionFilter)
export * from './filters';
// Logger utilities
export * from './logger';
// Root module (health check + CSRF)
export { RootModule } from './root/root.module';
// RFC 7807 Types (using named exports to avoid conflicts)
export type { ApiErrorResponse, ProblemDetails } from './types';
// Phone utilities
export { extractCountryFromPhone, normalizePhoneNumber } from './utils/phone.utils';
// Time utilities
export { parseExpiryToMs } from './utils/time.utils';

// Config system

// Core modules
export { AuthConfigModule } from './auth/auth-config.module';
export { Onboarding } from './auth/decorators/onboarding.decorator';
export { Public } from './auth/decorators/public.decorator';
export { UserId } from './auth/decorators/user-id.decorator';
// Guards
export { VrittiAuthGuard } from './auth/guards/vritti-auth.guard';
export { SseAuthGuard } from './auth/guards/sse-auth.guard';
// Token hash utilities
export { hashToken, verifyTokenHash } from './auth/utils/token-hash.util';
export {
  type ApiSdkConfig,
  type CookieConfig,
  configureApiSdk,
  defineConfig,
  type GuardConfig,
  getConfig,
  getJwtExpiry,
  getRefreshCookieOptions,
  type JwtConfig,
  resetConfig,
} from './config';
export { DatabaseModule } from './database/database.module';
// Decorators
export { Tenant } from './database/decorators/tenant.decorator';
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
// Exceptions
export * from './exceptions';
// RFC 7807 Filters (includes HttpExceptionFilter)
export * from './filters';
// Auth decorators (SkipCsrf for webhook endpoints)
export { SkipCsrf, SKIP_CSRF_KEY } from './auth/decorators/skip-csrf.decorator';
// Phone utilities
export { extractCountryFromPhone, normalizePhoneNumber } from './utils/phone.utils';
// Logger utilities
export * from './logger';
// RabbitMQ utilities
export * from './rabbitmq';
// RFC 7807 Types (using named exports to avoid conflicts)
export type { ApiErrorResponse, ProblemDetails } from './types';

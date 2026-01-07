// Config system
export {
  defineConfig,
  configureApiSdk,
  getConfig,
  resetConfig,
  getRefreshCookieOptions,
  getJwtExpiry,
  type ApiSdkConfig,
  type CookieConfig,
  type JwtConfig,
  type GuardConfig,
} from './config';

// Token hash utilities
export { hashToken, verifyTokenHash } from './auth/utils/token-hash.util';

// Core modules
export { AuthConfigModule } from './auth/auth-config.module';
export { DatabaseModule } from './database/database.module';

// Services
export { TenantContextService } from './database/services/tenant-context.service';
export { TenantDatabaseService } from './database/services/tenant-database.service';
export { PrimaryDatabaseService } from './database/services/primary-database.service';

// Repositories
export { PrimaryBaseRepository } from './database/repositories/primary-base.repository';
export { TenantBaseRepository } from './database/repositories/tenant-base.repository';

// Schema Registry (for module augmentation)
export type {
  SchemaRegistry,
  RegisteredSchema,
  TypedDrizzleClient,
} from './database/schema.registry';

// Guards
export { VrittiAuthGuard } from './auth/guards/vritti-auth.guard';

// Decorators
export { Tenant } from './database/decorators/tenant.decorator';
export { Onboarding } from './auth/decorators/onboarding.decorator';
export { Public } from './auth/decorators/public.decorator';

// Interfaces
export * from './database/interfaces';

// HTTP utilities
export { HttpModule } from './http/http.module';
export { CsrfGuard } from './http/guards/csrf.guard';

// RFC 7807 Filters (includes HttpExceptionFilter)
export * from './filters';

// RFC 7807 Types (using named exports to avoid conflicts)
export type { ProblemDetails, ApiErrorResponse } from './types';

// Exceptions
export * from './exceptions';

// Logger utilities
export * from './logger';

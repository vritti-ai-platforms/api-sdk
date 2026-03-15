import './types/fastify-augmentation';

// Config system

// Auth (decorators, guards, token utilities)
export * from './auth';
// Auth decorators (SkipCsrf for webhook endpoints)
export { SKIP_CSRF_KEY, SkipCsrf } from './auth/decorators/skip-csrf.decorator';
// JWT config utilities
export {
  type AccessTokenPayload,
  getTokenExpiry,
  jwtConfigFactory,
  type RefreshTokenPayload,
  type TokenExpiry,
  TokenType,
} from './auth/jwt.config';
// JWT auth service
export { JwtAuthService } from './auth/services/jwt-auth.service';
export type { ICacheProvider } from './cache';
// Cache module (Redis provider + ICacheProvider contract)
export { CACHE_PROVIDER, CacheModule, CacheService, RedisCacheProvider } from './cache';
export {
  type ApiSdkConfig,
  type CookieConfig,
  type CookieSerializeOptions,
  configureApiSdk,
  defineConfig,
  type GuardConfig,
  getConfig,
  getJwtExpiry,
  getRefreshCookieOptions,
  getRefreshCookieOptionsForHost,
  type JwtConfig,
  resetConfig,
} from './config';
export { DatabaseModule } from './database/database.module';
// Decorators
export { Tenant } from './database/decorators/tenant.decorator';
// Database DTOs
export { SelectOptionsQueryDto } from './database/dto/select-options-query.dto';
export { SuccessResponseDto } from './database/dto/success-response.dto';
export { TableResponseDto } from './database/dto/table-response.dto';
// Filter processor
export { type FieldDefinition, type FieldMap, FilterProcessor } from './database/filter/filter.processor';
export type {
  ColumnPinning,
  DensityType,
  FilterCondition,
  FilterOperator,
  SearchState,
  SortCondition,
  TableViewState,
} from './database/filter/filter.types';
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

// Data table module (views + ephemeral state)
export { DATA_TABLE_VIEWS_TABLE, DataTableModule, type DataTableModuleOptions } from './data-table/data-table.module';
export { DataTableViewsService } from './data-table/views/services/data-table-views.service';
export { DataTableStateService } from './data-table/state/services/data-table-state.service';
export {
  dataTableViewsColumns,
  dataTableViewsIndexes,
  type DataTableViewRecord,
  type NewDataTableViewRecord,
} from './data-table/schema/data-table-views.table';
export { DataTableViewDto } from './data-table/views/dto/entity/data-table-view.dto';
export { CreateDataTableViewDto } from './data-table/views/dto/request/create-data-table-view.dto';
export { UpdateDataTableViewDto } from './data-table/views/dto/request/update-data-table-view.dto';
export { RenameDataTableViewDto } from './data-table/views/dto/request/rename-data-table-view.dto';
export { ToggleShareDataTableViewDto } from './data-table/views/dto/request/toggle-share-data-table-view.dto';
export { UpsertDataTableStateDto } from './data-table/state/dto/request/upsert-data-table-state.dto';

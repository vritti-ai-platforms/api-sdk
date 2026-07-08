import './types/fastify-augmentation';

// Auth (decorators, guards, token utilities)
export * from './auth';
// Token types and config
export {
  type AccessTokenPayload,
  AUTH_CONFIG,
  AUTH_CONFIG_DEFAULTS,
  type AuthConfig,
  type CookieConfig,
  type CookieSerializeOptions,
  type DecodedAccessToken,
  type DecodedRefreshToken,
  type GuardConfig,
  type OnAuthenticatedCallback,
  type RefreshTokenPayload,
  type TokenExpiry,
  type TokenExpiryString,
  TokenType,
} from './auth/auth.config';
// Auth decorators (SkipCsrf for webhook endpoints)
export { SKIP_CSRF_KEY, SkipCsrf } from './auth/decorators/skip-csrf.decorator';
// Token service — generation, validation, and binding verification
export { TokenService } from './auth/services/token.service';
// Cache module moved to the './cache' subpath (@vritti/api-sdk/cache) so the main barrel never imports ioredis.
// Catalog resolver moved to the './catalog-resolver' subpath (@vritti/api-sdk/catalog-resolver).
// Context module — transport-agnostic request/response access + extensible transport registry
export * from './context';
// Data table module (views + ephemeral state)
export { DATA_TABLE_VIEWS_TABLE, DataTableModule, type DataTableModuleOptions } from './data-table/data-table.module';
export {
  type DataTableViewRecord,
  dataTableViewsColumns,
  dataTableViewsIndexes,
  type NewDataTableViewRecord,
} from './data-table/schema/data-table-views.table';
export { UpsertDataTableStateDto } from './data-table/state/dto/request/upsert-data-table-state.dto';
export { DataTableStateService } from './data-table/state/services/data-table-state.service';
export { DataTableViewDto } from './data-table/views/dto/entity/data-table-view.dto';
export { CreateDataTableViewDto } from './data-table/views/dto/request/create-data-table-view.dto';
export { RenameDataTableViewDto } from './data-table/views/dto/request/rename-data-table-view.dto';
export { ToggleShareDataTableViewDto } from './data-table/views/dto/request/toggle-share-data-table-view.dto';
export { UpdateDataTableViewDto } from './data-table/views/dto/request/update-data-table-view.dto';
export { DataTableViewsService } from './data-table/views/services/data-table-views.service';
export { DatabaseModule } from './database/database.module';
// Database DTOs
export { CreateResponseDto } from './database/dto/create-response.dto';
export { CursorListResponseDto } from './database/dto/cursor-list-response.dto';
export { ImportResponseDto, ImportSummaryDto, ValidatedRowDto } from './database/dto/import-response.dto';
export { SelectOptionsQueryDto } from './database/dto/select-options-query.dto';
export { SuccessResponseDto } from './database/dto/success-response.dto';
export { TableResponseDto } from './database/dto/table-response.dto';
// Cursor / keyset pagination
export { CursorCodec } from './database/filter/cursor.codec';
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
export { FilterOperators } from './database/filter/filter.types';
export { type KeysetOrderBy, KeysetProcessor, keysetSignature, MAX_PAGE_SIZE } from './database/filter/keyset.processor';
// Interfaces
export * from './database/interfaces';
// Repositories
export { PrimaryBaseRepository } from './database/repositories/primary-base.repository';
export type { TypedDrizzleClient } from './database/schema.registry';
export { PrimaryDatabaseService } from './database/services/primary-database.service';
// Database types
export type {
  FindForSelectConfig,
  FindForSelectJoin,
  SelectQueryGroup,
  SelectQueryOption,
  SelectQueryResult,
} from './database/types';
export { IsDateTime } from './decorators/is-date-time.decorator';
// Decorators
export { UploadedFile, type UploadedFileResult, UploadedFiles } from './decorators/uploaded-file.decorator';
// Icon-name validation is NOT re-exported here — import from '@vritti/api-sdk/icons' to keep icon-names.json out of the main bundle.
// Email module moved to the './email' subpath (@vritti/api-sdk/email) so the main barrel never imports @getbrevo/brevo.
// Exceptions
export * from './exceptions';
// RFC 7807 Filters (includes HttpExceptionFilter)
export * from './filters';
// License module moved to the './license' subpath (@vritti/api-sdk/license).
// Logger utilities
export * from './logger';
// Money module lives on the './money' subpath; re-exported here for backwards-compat (server lib, no bundle cost) — new code should prefer './money'.
export * from './money';
// NATS exports moved to the './nats' subpath so the main barrel never imports @nestjs/microservices.
// Root module (health check + CSRF)
export { RootModule } from './root/root.module';
// RFC 7807 Types (using named exports to avoid conflicts)
export type { ApiErrorResponse, ProblemDetails } from './types';
// Math utilities
export { gcd } from './utils/math.utils';
// Phone utilities
export { extractCountryFromPhone, normalizePhoneNumber } from './utils/phone.utils';
// Time utilities
export { parseExpiryToMs } from './utils/time.utils';

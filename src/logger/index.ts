/**
 * Logger Module
 *
 * Provides a comprehensive logging infrastructure for NestJS applications with:
 * - Environment presets (development, staging, production, test)
 * - Correlation ID tracking across async operations
 * - HTTP request/response logging
 * - Winston integration with file and console logging
 *
 * @module logger
 */

export { HttpLoggerInterceptor } from './interceptors/http-logger.interceptor';
// ============================================================================
// Main Module (Import this in your AppModule)
// ============================================================================
export { LOGGER_MODULE_OPTIONS, LoggerModule } from './logger.module';

// ============================================================================
// Middleware & Interceptors
// ============================================================================
export { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
// ============================================================================
// Main Service (Inject this in your services)
// ============================================================================
export { LoggerService } from './services/logger.service';

// ============================================================================
// Type Definitions
// ============================================================================
export type {
  CorrelationContext,
  HttpLoggerOptions,
  LogFormat,
  LoggerModuleAsyncOptions,
  LoggerModuleOptions,
  LoggerOptionsFactory,
  LogLevel,
  LogMetadata,
} from './types';

// ============================================================================
// Utility Functions
// ============================================================================
export {
  addCorrelationIdToResponse,
  // AsyncLocalStorage management
  correlationStorage,
  // Correlation ID helpers
  DEFAULT_CORRELATION_HEADER,
  generateCorrelationId,
  getCorrelationContext,
  runWithCorrelationContext,
  updateCorrelationContext,
} from './utils';

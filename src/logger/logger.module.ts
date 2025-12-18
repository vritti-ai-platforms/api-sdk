/**
 * Logger Module
 *
 * Dynamic NestJS module providing unified logging infrastructure with:
 * - Environment presets (development, staging, production, test)
 * - Transparent switching between default NestJS Logger and Winston
 * - Correlation ID tracking via middleware
 * - HTTP request/response logging via interceptor
 * - PII masking and file logging support
 *
 * @module logger/logger.module
 */

import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
  Logger,
} from '@nestjs/common';
import type {
  LoggerModuleOptions,
  LoggerModuleAsyncOptions,
  LoggerOptionsFactory,
} from './types';
import { LoggerService } from './services/logger.service';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { HttpLoggerInterceptor } from './interceptors/http-logger.interceptor';

// ============================================================================
// Constants (inline from constants.ts)
// ============================================================================

/**
 * Dependency injection token for logger module options
 */
export const LOGGER_MODULE_OPTIONS = Symbol('LOGGER_MODULE_OPTIONS');

/**
 * Default options for the logger module
 */
const DEFAULT_LOGGER_OPTIONS = {
  provider: 'winston' as const,
  enableCorrelationId: true,
  enableHttpLogger: true,
  filePath: './logs',
  maxFiles: '14d',
} as const;

// ============================================================================
// Environment Presets (NEW - replaces process.env auto-detection)
// ============================================================================

/**
 * Predefined environment configurations.
 * Users must explicitly pass `environment` option to select a preset.
 * All preset values can be overridden by passing explicit options.
 *
 * @example
 * ```typescript
 * // Use production preset
 * LoggerModule.forRoot({
 *   environment: 'production',
 *   appName: 'my-service'
 * })
 *
 * // Use development preset with custom level override
 * LoggerModule.forRoot({
 *   environment: 'development',
 *   level: 'verbose'  // Overrides preset's 'debug'
 * })
 * ```
 */
const ENVIRONMENT_PRESETS: Record<string, Partial<LoggerModuleOptions>> = {
  /**
   * Development preset - maximum verbosity for local development
   */
  development: {
    provider: 'winston',
    level: 'debug',
    format: 'text',
    enableFileLogger: false,
    enableCorrelationId: true,
    enableHttpLogger: true,
    httpLogger: {
      enableRequestLog: true,
      enableResponseLog: true,
      slowRequestThreshold: 1000, // 1 second - lower threshold for dev
    },
  },

  /**
   * Staging preset - moderate verbosity with file logging
   */
  staging: {
    provider: 'winston',
    level: 'log',
    format: 'json',
    enableFileLogger: true,
    enableCorrelationId: true,
    enableHttpLogger: true,
    httpLogger: {
      enableRequestLog: true,
      enableResponseLog: true,
      slowRequestThreshold: 3000, // 3 seconds
    },
  },

  /**
   * Production preset - minimal verbosity with all safety features enabled
   */
  production: {
    provider: 'winston',
    level: 'warn',
    format: 'json',
    enableFileLogger: true,
    enableCorrelationId: true,
    enableHttpLogger: true,
    httpLogger: {
      enableRequestLog: false, // Reduce noise in production
      enableResponseLog: true,
      slowRequestThreshold: 5000, // 5 seconds - higher threshold for prod
    },
  },

  /**
   * Test preset - errors only, minimal features for faster test execution
   */
  test: {
    provider: 'winston',
    level: 'error',
    format: 'json',
    enableFileLogger: false,
    enableCorrelationId: false,
    enableHttpLogger: false,
  },
} as const;

// ============================================================================
// Configuration Merging (refactored to use presets instead of process.env)
// ============================================================================

/**
 * Merges user-provided options with environment preset defaults.
 *
 * Merge order (later overrides earlier):
 * 1. DEFAULT_LOGGER_OPTIONS (base defaults)
 * 2. Environment preset (if `environment` option is provided)
 * 3. User-provided options (highest priority)
 *
 * **IMPORTANT**: No process.env access. Users must explicitly pass `environment`.
 *
 * @param options - User-provided logger options
 * @returns Merged options with all defaults applied
 *
 * @example
 * ```typescript
 * // With environment preset
 * const merged = mergeWithDefaults({ environment: 'production', appName: 'my-app' });
 * // Returns: production preset + { appName: 'my-app' }
 *
 * // Without environment (uses development as fallback)
 * const merged = mergeWithDefaults({ level: 'verbose' });
 * // Returns: development preset + { level: 'verbose' }
 * ```
 */
function mergeWithDefaults(options: LoggerModuleOptions = {}): LoggerModuleOptions {
  // Select preset based on explicit environment option (defaults to development)
  const preset = options.environment
    ? (ENVIRONMENT_PRESETS[options.environment] ?? ENVIRONMENT_PRESETS.development)
    : ENVIRONMENT_PRESETS.development;

  // Filter out undefined values from user options to avoid overriding preset defaults
  const filteredOptions = Object.fromEntries(
    Object.entries(options).filter(([_, value]) => value !== undefined)
  );

  // Handle nested httpLogger object - merge with preset httpLogger if both exist
  if (filteredOptions.httpLogger && preset?.httpLogger) {
    filteredOptions.httpLogger = {
      ...preset.httpLogger,
      ...Object.fromEntries(
        Object.entries(filteredOptions.httpLogger).filter(([_, value]) => value !== undefined)
      ),
    };
  }

  // Merge: base defaults < preset < user options (with undefined values removed)
  const merged = {
    ...DEFAULT_LOGGER_OPTIONS,
    ...preset,
    ...filteredOptions,
  };

  return merged;
}

// ============================================================================
// Provider Factories (inline from logging.providers.ts)
// ============================================================================

/**
 * Creates the default NestJS Logger provider.
 * Creates a fresh Logger instance to avoid circular reference issues.
 *
 * @param options - Merged logger module options
 * @returns Logger provider
 */
function createDefaultLoggerProvider(options: LoggerModuleOptions): Provider {
  return {
    provide: Logger,
    useFactory: () => {
      const logger = new Logger();

      // Set log levels if specified and method exists
      if (options.level && typeof (logger as any).setLogLevels === 'function') {
        const levels = getLevelsUpTo(options.level);
        (logger as any).setLogLevels(levels);
      }

      return logger;
    },
  };
}

/**
 * Creates all logger providers based on the configuration.
 *
 * @param options - User-provided logger options (will be merged with defaults)
 * @returns Complete array of providers for the logger module
 */
function createLoggerProviders(options: LoggerModuleOptions = {}): Provider[] {
  // Merge user options with preset defaults
  const mergedOptions = mergeWithDefaults(options);

  // Base providers (always included)
  const providers: Provider[] = [
    // Options provider
    {
      provide: LOGGER_MODULE_OPTIONS,
      useValue: mergedOptions,
    },
  ];

  // Default logger provider (only if using default provider)
  if (mergedOptions.provider === 'default') {
    providers.push(createDefaultLoggerProvider(mergedOptions));
  }

  // Unified LoggerService facade (always included)
  providers.push({
    provide: LoggerService,
    useFactory: (opts: LoggerModuleOptions, defaultLogger?: Logger) => {
      return new LoggerService(opts, defaultLogger);
    },
    inject: [LOGGER_MODULE_OPTIONS, { token: Logger, optional: true }],
  });

  // Correlation ID middleware
  providers.push({
    provide: CorrelationIdMiddleware,
    useFactory: () => {
      return new CorrelationIdMiddleware({
        includeInResponse: true,
        responseHeader: 'x-correlation-id',
      });
    },
  });

  // HTTP logger interceptor
  providers.push({
    provide: HttpLoggerInterceptor,
    useFactory: (logger: LoggerService, opts: LoggerModuleOptions) => {
      // Use detailed httpLogger config if provided, otherwise fall back to simple enableHttpLogger
      const httpLoggerOptions = opts.httpLogger ?? {
        enableRequestLog: opts.enableHttpLogger,
        enableResponseLog: opts.enableHttpLogger,
      };
      return new HttpLoggerInterceptor(logger, httpLoggerOptions);
    },
    inject: [LoggerService, LOGGER_MODULE_OPTIONS],
  });

  return providers;
}

/** Valid NestJS log levels */
type NestLogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

/**
 * Helper function to get all log levels up to and including the specified level.
 */
function getLevelsUpTo(level: string): NestLogLevel[] {
  const allLevels: NestLogLevel[] = [
    'error',
    'warn',
    'log',
    'debug',
    'verbose',
  ];

  // Check if level is a valid NestLogLevel
  const isValidLevel = (l: string): l is NestLogLevel =>
    allLevels.includes(l as NestLogLevel);

  if (!isValidLevel(level)) {
    return ['error', 'warn', 'log'];
  }

  const levelIndex = allLevels.indexOf(level);
  return allLevels.slice(0, levelIndex + 1);
}

// ============================================================================
// Logger Module
// ============================================================================

/**
 * Global logger module providing unified logging infrastructure.
 *
 * Features:
 * - Environment presets (development, staging, production, test)
 * - Single `LoggerService` interface for all logging needs
 * - Transparent provider switching (default ↔ Winston)
 * - Correlation ID tracking across async operations
 * - HTTP request/response logging
 * - PII masking for GDPR compliance
 * - File-based logging with rotation
 *
 * @example
 * ```typescript
 * // Production environment with explicit config
 * @Module({
 *   imports: [
 *     LoggerModule.forRoot({
 *       environment: 'production',
 *       appName: 'my-service'
 *     })
 *   ],
 * })
 * export class AppModule {}
 *
 * // Development environment with custom override
 * @Module({
 *   imports: [
 *     LoggerModule.forRoot({
 *       environment: 'development',
 *       level: 'verbose'  // Override preset's debug
 *     })
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use default NestJS logger
 * @Module({
 *   imports: [
 *     LoggerModule.forRoot({
 *       provider: 'default',
 *       environment: 'development'
 *     })
 *   ],
 * })
 * export class AppModule {}
 *
 * // Dynamic configuration with ConfigService
 * @Module({
 *   imports: [
 *     LoggerModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (config: ConfigService) => ({
 *         environment: config.get('NODE_ENV', 'development'),
 *         provider: config.get('LOG_PROVIDER', 'winston'),
 *         appName: config.get('APP_NAME')
 *       }),
 *       inject: [ConfigService]
 *     })
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class LoggerModule implements NestModule {
  /**
   * Configures the logger module with static options.
   *
   * Users must explicitly pass `environment` to select a preset.
   * All preset values can be overridden by passing explicit options.
   *
   * @param options - Logger configuration options
   * @returns Dynamic module configuration
   *
   * @example
   * ```typescript
   * // Production preset with app name
   * LoggerModule.forRoot({
   *   environment: 'production',
   *   appName: 'my-service'
   * })
   *
   * // Development preset with custom level
   * LoggerModule.forRoot({
   *   environment: 'development',
   *   level: 'verbose',
   *   enableFileLogger: true
   * })
   *
   * // Use default NestJS logger
   * LoggerModule.forRoot({
   *   provider: 'default',
   *   environment: 'development'
   * })
   * ```
   */
  static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
    const providers = createLoggerProviders(options);

    return {
      module: LoggerModule,
      providers,
      exports: [LoggerService, CorrelationIdMiddleware, HttpLoggerInterceptor, LOGGER_MODULE_OPTIONS],
    };
  }

  /**
   * Configures the logger module with async options.
   *
   * Supports dynamic configuration using:
   * - `useFactory`: Factory function with dependency injection
   * - `useClass`: Class implementing `LoggerOptionsFactory`
   * - `useExisting`: Existing provider implementing `LoggerOptionsFactory`
   *
   * Options from the factory/class are merged with environment preset defaults.
   *
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   *
   * @example
   * ```typescript
   * // Factory with ConfigService
   * LoggerModule.forRootAsync({
   *   imports: [ConfigModule],
   *   useFactory: (config: ConfigService) => ({
   *     environment: config.get('NODE_ENV', 'development'),
   *     provider: config.get('LOG_PROVIDER', 'winston'),
   *     level: config.get('LOG_LEVEL'),
   *     appName: config.get('APP_NAME'),
   *   }),
   *   inject: [ConfigService]
   * })
   *
   * // Factory class
   * @Injectable()
   * class LoggerConfigService implements LoggerOptionsFactory {
   *   createLoggerOptions(): LoggerModuleOptions {
   *     return {
   *       environment: 'production',
   *       appName: 'my-service'
   *     };
   *   }
   * }
   *
   * LoggerModule.forRootAsync({
   *   useClass: LoggerConfigService
   * })
   * ```
   */
  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: LoggerModule,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        // Default logger provider
        {
          provide: Logger,
          useFactory: (opts: LoggerModuleOptions) => {
            if (opts.provider === 'default') {
              const logger = new Logger();
              if (opts.level && typeof (logger as any).setLogLevels === 'function') {
                const levels = getLevelsUpTo(opts.level);
                (logger as any).setLogLevels(levels);
              }
              return logger;
            }
            return null;
          },
          inject: [LOGGER_MODULE_OPTIONS],
        },
        // Unified logger service
        {
          provide: LoggerService,
          useFactory: (opts: LoggerModuleOptions, defaultLogger?: Logger) => {
            return new LoggerService(opts, defaultLogger);
          },
          inject: [LOGGER_MODULE_OPTIONS, { token: Logger, optional: true }],
        },
        // Correlation ID middleware
        {
          provide: CorrelationIdMiddleware,
          useFactory: () => {
            return new CorrelationIdMiddleware({
              includeInResponse: true,
              responseHeader: 'x-correlation-id',
            });
          },
        },
        // HTTP logger interceptor
        {
          provide: HttpLoggerInterceptor,
          useFactory: (logger: LoggerService, opts: LoggerModuleOptions) => {
            // Use detailed httpLogger config if provided, otherwise fall back to simple enableHttpLogger
            const httpLoggerOptions = opts.httpLogger ?? {
              enableRequestLog: opts.enableHttpLogger,
              enableResponseLog: opts.enableHttpLogger,
            };
            return new HttpLoggerInterceptor(logger, httpLoggerOptions);
          },
          inject: [LoggerService, LOGGER_MODULE_OPTIONS],
        },
      ],
      exports: [LoggerService, CorrelationIdMiddleware, HttpLoggerInterceptor, LOGGER_MODULE_OPTIONS],
    };
  }

  /**
   * Configures middleware for the module.
   * Middleware is registered globally in main.ts using Fastify hooks.
   */
  configure(consumer: MiddlewareConsumer): void {
    // Middleware is registered globally in main.ts using Fastify's addHook('onRequest')
    // This avoids DI issues with the middleware constructor
  }

  /**
   * Creates async providers for dynamic module configuration.
   */
  private static createAsyncProviders(options: LoggerModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    const providers: Provider[] = [this.createAsyncOptionsProvider(options)];

    if (options.useClass) {
      providers.push({
        provide: options.useClass,
        useClass: options.useClass,
      });
    }

    return providers;
  }

  /**
   * Creates the async options provider.
   */
  private static createAsyncOptionsProvider(options: LoggerModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: LOGGER_MODULE_OPTIONS,
        useFactory: async (...args: any[]) => {
          const userOptions = await options.useFactory!(...args);
          return mergeWithDefaults(userOptions);
        },
        inject: (options.inject || []) as any[],
      };
    }

    if (options.useClass) {
      return {
        provide: LOGGER_MODULE_OPTIONS,
        useFactory: async (optionsFactory: LoggerOptionsFactory) => {
          const userOptions = await optionsFactory.createLoggerOptions();
          return mergeWithDefaults(userOptions);
        },
        inject: [options.useClass],
      };
    }

    if (options.useExisting) {
      return {
        provide: LOGGER_MODULE_OPTIONS,
        useFactory: async (optionsFactory: LoggerOptionsFactory) => {
          const userOptions = await optionsFactory.createLoggerOptions();
          return mergeWithDefaults(userOptions);
        },
        inject: [options.useExisting],
      };
    }

    throw new Error(
      'LoggerModule.forRootAsync() requires one of: useFactory, useClass, or useExisting',
    );
  }
}

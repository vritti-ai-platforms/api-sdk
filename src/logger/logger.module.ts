import {
  type DynamicModule,
  Global,
  type InjectionToken,
  Logger,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
} from '@nestjs/common';
import { HttpLoggerInterceptor } from './interceptors/http-logger.interceptor';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { LoggerService } from './services/logger.service';
import type { LoggerModuleAsyncOptions, LoggerModuleOptions, LoggerOptionsFactory } from './types';

// ============================================================================
// Constants (inline from constants.ts)
// ============================================================================

export const LOGGER_MODULE_OPTIONS = Symbol('LOGGER_MODULE_OPTIONS');

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

const ENVIRONMENT_PRESETS: Record<string, Partial<LoggerModuleOptions>> = {
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

// Merges user-provided options with default and environment preset values
function mergeWithDefaults(options: LoggerModuleOptions = {}): LoggerModuleOptions {
  // Select preset based on explicit environment option (defaults to development)
  const preset = options.environment
    ? (ENVIRONMENT_PRESETS[options.environment] ?? ENVIRONMENT_PRESETS.development)
    : ENVIRONMENT_PRESETS.development;

  // Filter out undefined values from user options to avoid overriding preset defaults
  const filteredOptions = Object.fromEntries(Object.entries(options).filter(([_, value]) => value !== undefined));

  // Handle nested httpLogger object - merge with preset httpLogger if both exist
  if (filteredOptions.httpLogger && preset?.httpLogger) {
    filteredOptions.httpLogger = {
      ...preset.httpLogger,
      ...Object.fromEntries(Object.entries(filteredOptions.httpLogger).filter(([_, value]) => value !== undefined)),
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

// Creates the default NestJS Logger provider with optional log level configuration
function createDefaultLoggerProvider(options: LoggerModuleOptions): Provider {
  return {
    provide: Logger,
    useFactory: () => {
      const logger = new Logger();

      // Set log levels if specified and method exists
      if (options.level) {
        const levels = getLevelsUpTo(options.level);
        (logger as { setLogLevels?: (levels: NestLogLevel[]) => void }).setLogLevels?.(levels);
      }

      return logger;
    },
  };
}

// Builds all logger providers for the module based on merged configuration
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

type NestLogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

// Returns all NestJS log levels up to and including the specified level
function getLevelsUpTo(level: string): NestLogLevel[] {
  const allLevels: NestLogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

  // Check if level is a valid NestLogLevel
  const isValidLevel = (l: string): l is NestLogLevel => allLevels.includes(l as NestLogLevel);

  if (!isValidLevel(level)) {
    return ['error', 'warn', 'log'];
  }

  const levelIndex = allLevels.indexOf(level);
  return allLevels.slice(0, levelIndex + 1);
}

// ============================================================================
// Logger Module
// ============================================================================

@Global()
@Module({})
export class LoggerModule implements NestModule {
  // Configures the logger module with static options and environment preset
  static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
    const providers = createLoggerProviders(options);

    return {
      module: LoggerModule,
      providers,
      exports: [LoggerService, CorrelationIdMiddleware, HttpLoggerInterceptor, LOGGER_MODULE_OPTIONS],
    };
  }

  // Configures the logger module with async options (useFactory, useClass, useExisting)
  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const asyncProviders = LoggerModule.createAsyncProviders(options);

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
              if (opts.level) {
                const levels = getLevelsUpTo(opts.level);
                (logger as { setLogLevels?: (levels: NestLogLevel[]) => void }).setLogLevels?.(levels);
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

  // Middleware registration is handled globally in main.ts via Fastify hooks
  configure(_consumer: MiddlewareConsumer): void {
    // Middleware is registered globally in main.ts using Fastify's addHook('onRequest')
    // This avoids DI issues with the middleware constructor
  }

  // Creates async providers for dynamic module configuration
  private static createAsyncProviders(options: LoggerModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [LoggerModule.createAsyncOptionsProvider(options)];
    }

    const providers: Provider[] = [LoggerModule.createAsyncOptionsProvider(options)];

    if (options.useClass) {
      providers.push({
        provide: options.useClass,
        useClass: options.useClass,
      });
    }

    return providers;
  }

  // Creates the DI provider that resolves and merges async logger options
  private static createAsyncOptionsProvider(options: LoggerModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: LOGGER_MODULE_OPTIONS,
        useFactory: async (...args: unknown[]) => {
          const userOptions = await options.useFactory?.(...args);
          return mergeWithDefaults(userOptions);
        },
        inject: (options.inject || []) as InjectionToken[],
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

    throw new Error('LoggerModule.forRootAsync() requires one of: useFactory, useClass, or useExisting');
  }
}

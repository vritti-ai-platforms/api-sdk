import type { ModuleMetadata, Type } from '@nestjs/common';

export type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

export type LogFormat = 'json' | 'text';

export interface LogMetadata {
  correlationId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface LoggerModuleOptions {
  provider?: 'default' | 'winston';
  level?: LogLevel;
  format?: LogFormat;
  enableFileLogger?: boolean;
  filePath?: string;
  maxFiles?: string;
  enableCorrelationId?: boolean;
  enableHttpLogger?: boolean;
  httpLogger?: HttpLoggerOptions;
  appName?: string;
  environment?: string;
  defaultMeta?: Record<string, unknown>;
}

export interface LoggerOptionsFactory {
  createLoggerOptions(): Promise<LoggerModuleOptions> | LoggerModuleOptions;
}

export interface LoggerModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<LoggerOptionsFactory>;
  useClass?: Type<LoggerOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<LoggerModuleOptions> | LoggerModuleOptions;
  inject?: unknown[];
}

export interface CorrelationContext {
  correlationId: string;
  [key: string]: unknown;
}

export interface HttpLoggerOptions {
  enableRequestLog?: boolean;
  enableResponseLog?: boolean;
  enableRequestBodyLog?: boolean;
  enableResponseBodyLog?: boolean;
  slowRequestThreshold?: number;
  excludedRoutes?: string[];
  maskedHeaders?: string[];
  maxBodySize?: number;
}

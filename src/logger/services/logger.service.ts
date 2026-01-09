/**
 * Unified Logger Service
 *
 * Single service that provides both default NestJS Logger and Winston logger implementations.
 * Automatically delegates to the configured provider (default or winston).
 * @module logger/logger.service
 */

import { Injectable, type Logger, type LoggerService as NestLoggerService, Optional } from '@nestjs/common';
import { createLogger, format, transports, type Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { LoggerModuleOptions, LogLevel, LogMetadata } from '../types';
import { getCorrelationContext } from '../utils';

/**
 * Type for log message parameter.
 * NestJS LoggerService interface uses `any` for compatibility,
 * but this type documents the expected message shapes.
 *
 * @remarks
 * The public interface methods use `any` to maintain compatibility with
 * NestJS's LoggerService interface. This type is for documentation purposes.
 */
export type LogMessage = string | Error | object;

/**
 * Unified logger service implementing NestJS LoggerService interface.
 * Supports both default NestJS Logger and Winston implementations via facade pattern.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly activeLogger: NestLoggerService | WinstonLogger;
  private readonly options: LoggerModuleOptions;
  private context?: string;

  constructor(
    @Optional() options: LoggerModuleOptions = {},
    @Optional() private readonly defaultLogger?: Logger,
  ) {
    this.options = options;
    const provider = options.provider ?? 'winston';

    if (provider === 'default') {
      if (!this.defaultLogger) {
        throw new Error('LoggerService: Default Logger not provided');
      }
      this.activeLogger = this.defaultLogger;
    } else {
      this.activeLogger = this.createWinstonLogger(options);
    }
  }

  /**
   * Creates a Winston logger instance with inline configuration.
   * Consolidates winston-config.factory.ts logic.
   */
  private createWinstonLogger(opts: LoggerModuleOptions): WinstonLogger {
    const level = opts.level ?? 'debug';
    const logFormat = opts.format ?? 'text';

    // Base formatters
    // Winston automatically merges metadata into the info object, so all properties
    // (context, correlationId, etc.) are already at the top level
    const baseFormatters = [format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), format.errors({ stack: true })];

    // Console transport
    const consoleTransport =
      logFormat === 'json'
        ? new transports.Console({
            level,
            format: format.combine(...baseFormatters, format.json()),
          })
        : new transports.Console({
            level,
            format: format.combine(
              ...baseFormatters,
              format.printf((info) => {
                const { timestamp, level, message, context, correlationId, trace } = info;
                const parts = [
                  timestamp,
                  level.toUpperCase().padEnd(7),
                  correlationId ? `[${correlationId.toString().slice(-6)}]` : '',
                  context ? `[${context}]` : '',
                  message,
                ].filter(Boolean);
                let output = parts.join(' ');

                // Append stack trace on new line if present
                if (trace) {
                  output += `\n${trace}`;
                }

                return output;
              }),
              format.colorize({ all: true }),
            ),
          });

    const winstonTransports: any[] = [consoleTransport];

    // File transports
    if (opts.enableFileLogger) {
      const filePath = opts.filePath ?? './logs';
      const maxFiles = opts.maxFiles ?? '14d';

      winstonTransports.push(
        new DailyRotateFile({
          level,
          filename: `${filePath}/%DATE%-combined.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles,
          format: format.combine(format.timestamp(), format.json()),
        }),
        new DailyRotateFile({
          level: 'error',
          filename: `${filePath}/%DATE%-error.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles,
          format: format.combine(format.timestamp(), format.json()),
        }),
      );
    }

    const config: any = {
      level,
      transports: winstonTransports,
      exitOnError: false,
    };

    if (opts.defaultMeta || opts.appName) {
      config.defaultMeta = {
        ...opts.defaultMeta,
        appName: opts.appName,
        environment: opts.environment,
      };
    }

    return createLogger(config);
  }

  // NestJS LoggerService interface methods
  log(message: any, context?: string): void {
    this._log('log', message, context);
  }

  error(message: any, trace?: string, context?: string): void {
    this._log('error', message, context, trace);
  }

  warn(message: any, context?: string): void {
    this._log('warn', message, context);
  }

  debug(message: any, context?: string): void {
    this._log('debug', message, context);
  }

  verbose(message: any, context?: string): void {
    this._log('verbose', message, context);
  }

  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Unified internal logging method that handles both Winston and NestJS Logger.
   */
  private _log(level: LogLevel, message: any, context?: string, trace?: string): void {
    const ctx = context ?? this.context;

    // Check if Winston logger by duck typing
    if ('format' in this.activeLogger && 'transports' in this.activeLogger) {
      // Winston logger path
      const winstonLogger = this.activeLogger as WinstonLogger;
      const winstonLevel = level === 'log' ? 'info' : level;
      const formattedMessage = this.formatMessage(message);
      const metadata = this.enrichMetadata({}, ctx, trace);
      // Winston merges all properties into the info object when using object syntax
      winstonLogger.log({ level: winstonLevel, message: formattedMessage, ...metadata });
    } else {
      // NestJS logger path
      const nestLogger = this.activeLogger as Logger;
      if (level === 'error' && trace) {
        ctx ? nestLogger.error(message, trace, ctx) : nestLogger.error(message, trace);
      } else if (level === 'log') {
        ctx ? nestLogger.log(message, ctx) : nestLogger.log(message);
      } else if (level === 'warn') {
        ctx ? nestLogger.warn(message, ctx) : nestLogger.warn(message);
      } else if (level === 'debug' && nestLogger.debug) {
        ctx ? nestLogger.debug(message, ctx) : nestLogger.debug(message);
      } else if (level === 'verbose' && nestLogger.verbose) {
        ctx ? nestLogger.verbose(message, ctx) : nestLogger.verbose(message);
      }
    }
  }

  /**
   * Logs with custom metadata (Winston only).
   */
  logWithMetadata(level: LogLevel, message: any, metadata?: LogMetadata, context?: string): void {
    const ctx = context ?? this.context;

    // Check if Winston logger by duck typing
    if ('format' in this.activeLogger && 'transports' in this.activeLogger) {
      const winstonLogger = this.activeLogger as WinstonLogger;
      const winstonLevel = level === 'log' ? 'info' : level;
      // const enriched = this.enrichMetadata(metadata, ctx);
      // Winston merges all properties into the info object when using object syntax
      winstonLogger.log({ level: winstonLevel, message: this.formatMessage(message), ...metadata });
    } else {
      // Fallback for default logger
      const messageWithMeta = metadata ? `${message} ${JSON.stringify(metadata)}` : message;
      this[level](messageWithMeta, ctx);
    }
  }

  private formatMessage(message: any): string {
    if (message instanceof Error) return message.message;
    if (typeof message === 'object' && message !== null) {
      try {
        return JSON.stringify(message);
      } catch {
        return String(message);
      }
    }
    return String(message);
  }

  /**
   * Enriches metadata with correlation context from AsyncLocalStorage.
   * Inline from winston-logger.service.ts
   */
  private enrichMetadata(metadata: LogMetadata = {}, context?: string, trace?: string): LogMetadata {
    const enriched: LogMetadata = { ...metadata };

    if (context) enriched.context = context;

    const correlationContext = getCorrelationContext();
    if (correlationContext) {
      if (correlationContext.correlationId) enriched.correlationId = correlationContext.correlationId;
      for (const [key, value] of Object.entries(correlationContext)) {
        if (key !== 'correlationId') {
          enriched[key] = value;
        }
      }
    }

    if (trace) enriched.trace = trace;

    return enriched;
  }

  child(context: string): LoggerService {
    const childLogger = new LoggerService(this.options, this.defaultLogger);
    childLogger.setContext(context);
    return childLogger;
  }
}

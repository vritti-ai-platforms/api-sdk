/**
 * HTTP Logger Interceptor
 *
 * Automatically logs HTTP requests and responses with correlation tracking.
 * @module logger/http-logger.interceptor
 */

import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, Optional } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';
import type { HttpLoggerOptions, LogMetadata } from '../types';
import { getCorrelationContext } from '../utils';

/**
 * HTTP Logger Interceptor for NestJS applications.
 *
 * Logs all HTTP requests and responses with metadata including
 * correlation IDs, performance metrics, and error details.
 */
@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  private readonly enableRequestLog: boolean;
  private readonly enableResponseLog: boolean;
  private readonly slowRequestThreshold: number;

  constructor(
    private readonly logger: LoggerService,
    @Optional() options?: HttpLoggerOptions,
  ) {
    this.enableRequestLog = options?.enableRequestLog ?? true;
    this.enableResponseLog = options?.enableResponseLog ?? true;
    this.slowRequestThreshold = options?.slowRequestThreshold ?? 3000; // 3 seconds
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<FastifyRequest>();
    const response = httpContext.getResponse<FastifyReply>();

    const startTime = Date.now();

    // Log incoming request
    if (this.enableRequestLog) {
      this.logRequest(request);
    }

    // Process request and log response/errors
    return next.handle().pipe(
      tap(() => {
        if (this.enableResponseLog) {
          const duration = Date.now() - startTime;
          this.logResponse(request, response, duration);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logError(request, response, duration, error);
        throw error;
      }),
    );
  }

  private logRequest(request: FastifyRequest): void {
    try {
      const correlationContext = getCorrelationContext();
      const metadata: LogMetadata = {
        type: 'http_request',
        method: request.method,
        url: request.url,
        correlationId: correlationContext?.correlationId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

      this.logger.logWithMetadata('log', `Incoming ${request.method} ${request.url}`, metadata);
    } catch (error) {
      this.logger.error('Failed to log HTTP request', (error as Error).stack);
    }
  }

  private logResponse(request: FastifyRequest, response: FastifyReply, duration: number): void {
    try {
      const correlationContext = getCorrelationContext();
      const statusCode = response.statusCode;

      // Determine log level based on status code
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';

      const metadata: LogMetadata = {
        type: 'http_response',
        method: request.method,
        url: request.url,
        statusCode,
        duration,
        correlationId: correlationContext?.correlationId,
      };

      // Flag slow requests
      if (duration > this.slowRequestThreshold) {
        metadata.slowRequest = true;
      }

      const message = metadata.slowRequest
        ? `SLOW ${request.method} ${request.url} ${statusCode} - ${duration}ms`
        : `${request.method} ${request.url} ${statusCode} - ${duration}ms`;

      this.logger.logWithMetadata(logLevel, message, metadata);
    } catch (error) {
      this.logger.error('Failed to log HTTP response', (error as Error).stack);
    }
  }

  private logError(request: FastifyRequest, response: FastifyReply, duration: number, error: any): void {
    try {
      const correlationContext = getCorrelationContext();
      const statusCode = response.statusCode || 500;

      const metadata: LogMetadata = {
        type: 'http_error',
        method: request.method,
        url: request.url,
        statusCode,
        duration,
        correlationId: correlationContext?.correlationId,
        errorName: error?.name || 'Error',
        errorMessage: error?.message || 'Unknown error',
      };

      if (error?.stack) {
        metadata.trace = error.stack;
      }

      if (error?.response) {
        metadata.errorDetails = error.response;
      }

      const message = `ERROR ${request.method} ${request.url} ${statusCode} - ${error?.message || 'Unknown error'}`;
      this.logger.logWithMetadata('error', message, metadata);
    } catch (loggingError) {
      this.logger.error('Failed to log HTTP error', (loggingError as Error).stack);
    }
  }
}

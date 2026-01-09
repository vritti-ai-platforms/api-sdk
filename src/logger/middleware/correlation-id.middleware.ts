/**
 * Correlation ID Middleware
 *
 * Generates unique correlation IDs for request tracking across async operations.
 * Stores correlation ID in AsyncLocalStorage for access throughout the request lifecycle.
 * @module logger/correlation-id.middleware
 */

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  addCorrelationIdToResponse,
  correlationStorage,
  DEFAULT_CORRELATION_HEADER,
  generateCorrelationId,
  runWithCorrelationContext,
} from '../utils';

/**
 * Configuration options for the Correlation ID middleware.
 */
export interface CorrelationIdMiddlewareOptions {
  /**
   * If true, adds the correlation ID to response headers.
   * @default true
   */
  includeInResponse?: boolean;

  /**
   * The header name to use when adding correlation ID to response.
   * @default 'x-correlation-id'
   */
  responseHeader?: string;
}

/**
 * Correlation ID Middleware for Fastify/NestJS applications.
 *
 * Generates a unique correlation ID for each request,
 * stores it in AsyncLocalStorage for access throughout the request lifecycle,
 * and optionally adds it to response headers.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly includeInResponse: boolean;
  private readonly responseHeader: string;

  constructor(options: CorrelationIdMiddlewareOptions = {}) {
    this.includeInResponse = options.includeInResponse ?? true;
    this.responseHeader = options.responseHeader ?? DEFAULT_CORRELATION_HEADER;
  }

  /**
   * Middleware handler for processing requests.
   */
  use(_req: FastifyRequest, reply: FastifyReply, next: () => void): void {
    // Generate new correlation ID for this request
    const correlationId = generateCorrelationId();

    // Add to response headers if enabled
    if (this.includeInResponse) {
      addCorrelationIdToResponse(reply, correlationId, this.responseHeader);
    }

    // Run the rest of the request in AsyncLocalStorage context
    runWithCorrelationContext({ correlationId }, () => {
      next();
    });
  }

  /**
   * Fastify hook handler for onRequest.
   * This is an async function that returns a Promise, ensuring the AsyncLocalStorage
   * context persists throughout the entire request lifecycle.
   */
  async onRequest(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Generate new correlation ID for this request
    const correlationId = generateCorrelationId();

    // Add to response headers if enabled
    if (this.includeInResponse) {
      addCorrelationIdToResponse(reply, correlationId, this.responseHeader);
    }

    // Store in AsyncLocalStorage for the request lifecycle
    // Note: We don't wrap in runWithCorrelationContext here because
    // Fastify's async context tracking handles it automatically
    const store = correlationStorage.getStore();
    if (!store) {
      // Initialize new store
      correlationStorage.enterWith({ correlationId });
    }
  }
}

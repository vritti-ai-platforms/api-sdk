import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  addCorrelationIdToResponse,
  correlationStorage,
  DEFAULT_CORRELATION_HEADER,
  generateCorrelationId,
  runWithCorrelationContext,
} from '../utils';

export interface CorrelationIdMiddlewareOptions {
  includeInResponse?: boolean;
  responseHeader?: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly includeInResponse: boolean;
  private readonly responseHeader: string;

  constructor(options: CorrelationIdMiddlewareOptions = {}) {
    this.includeInResponse = options.includeInResponse ?? true;
    this.responseHeader = options.responseHeader ?? DEFAULT_CORRELATION_HEADER;
  }

  // Generates and stores a correlation ID for the incoming request
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

  // Fastify onRequest hook that initializes correlation context in AsyncLocalStorage
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

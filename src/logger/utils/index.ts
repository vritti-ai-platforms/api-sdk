/**
 * Logging Utilities
 *
 * Consolidated utilities for correlation tracking, PII masking, and async context management.
 * @module logging/utils
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type { CorrelationContext } from '../types';

// ============================================================================
// Async Context Management (AsyncLocalStorage)
// ============================================================================

/**
 * Async local storage for correlation context tracking across async operations.
 */
export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Gets the current correlation context from async local storage.
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

/**
 * Runs a callback within a correlation context.
 */
export function runWithCorrelationContext<T>(context: CorrelationContext, callback: () => T): T {
  return correlationStorage.run(context, callback);
}

/**
 * Updates the current correlation context with new values.
 */
export function updateCorrelationContext(updates: Partial<CorrelationContext>): void {
  const context = correlationStorage.getStore();
  if (context) {
    Object.assign(context, updates);
  }
}

// ============================================================================
// Correlation ID Management
// ============================================================================

/**
 * Default header name for setting correlation ID in responses.
 */
export const DEFAULT_CORRELATION_HEADER = 'x-correlation-id';

/**
 * Generates a new correlation ID using UUID v4.
 * Always creates a fresh ID for each request.
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Adds correlation ID to Fastify response headers.
 */
export function addCorrelationIdToResponse(
  reply: FastifyReply,
  correlationId: string,
  headerName: string = DEFAULT_CORRELATION_HEADER,
): void {
  if (typeof reply.header === 'function') {
    reply.header(headerName, correlationId);
  } else if (reply.raw && typeof reply.raw.setHeader === 'function') {
    reply.raw.setHeader(headerName, correlationId);
  }
}

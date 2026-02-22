import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type { CorrelationContext } from '../types';

// ============================================================================
// Async Context Management (AsyncLocalStorage)
// ============================================================================

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

// Returns the current correlation context from AsyncLocalStorage
export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

// Runs a callback within the given correlation context
export function runWithCorrelationContext<T>(context: CorrelationContext, callback: () => T): T {
  return correlationStorage.run(context, callback);
}

// Updates the current correlation context with new values
export function updateCorrelationContext(updates: Partial<CorrelationContext>): void {
  const context = correlationStorage.getStore();
  if (context) {
    Object.assign(context, updates);
  }
}

// ============================================================================
// Correlation ID Management
// ============================================================================

export const DEFAULT_CORRELATION_HEADER = 'x-correlation-id';

// Generates a new UUID v4 correlation ID for the current request
export function generateCorrelationId(): string {
  return randomUUID();
}

// Adds the correlation ID to Fastify response headers
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

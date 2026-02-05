/**
 * RabbitMQ Module
 *
 * Provides utilities for RabbitMQ-based microservices communication:
 * - Base client service with timeout and retry logic
 * - Automatic message acknowledgment interceptor
 * - Payload validation pipe
 *
 * @module rabbitmq
 */

// ============================================================================
// Services (Use in API Gateway)
// ============================================================================

export { RmqClientService } from './services/rmq-client.service';

// ============================================================================
// Interceptors (Use in Microservices)
// ============================================================================

export { RmqAckInterceptor } from './interceptors/rmq-ack.interceptor';

// ============================================================================
// Pipes (Use in Microservices)
// ============================================================================

export { RmqValidationPipe } from './pipes/rmq-validation.pipe';

// ============================================================================
// Type Definitions
// ============================================================================

export type { RmqPattern, RmqSendOptions, RmqValidationError } from './types';

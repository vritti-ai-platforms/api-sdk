/**
 * RabbitMQ Type Definitions
 *
 * Type definitions for RabbitMQ message patterns and configuration.
 * @module rabbitmq/types
 */

// ============================================================================
// Message Pattern Types
// ============================================================================

/**
 * Message pattern structure for RabbitMQ routing.
 * Uses role + cmd pattern for organized message routing.
 *
 * @example
 * ```typescript
 * const pattern: RmqPattern = { role: 'customers', cmd: 'get_all' };
 * ```
 */
export interface RmqPattern {
  role: string;
  cmd: string;
}

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * Options for RabbitMQ send operations.
 */
export interface RmqSendOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Number of retry attempts (default: 0) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * RPC Exception response format for validation errors.
 */
export interface RmqValidationError {
  statusCode: number;
  message: string;
  errors: string[];
}

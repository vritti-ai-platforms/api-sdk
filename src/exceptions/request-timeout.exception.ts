import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when a request takes too long to process (HTTP 408).
 * Used when the client or server times out while waiting for completion.
 *
 * @example
 * // Simple message
 * throw new RequestTimeoutException('Request timeout');
 *
 * // With custom title and detail
 * throw new RequestTimeoutException({
 *   title: 'Operation Timeout',
 *   detail: 'The request took too long to complete',
 * });
 *
 * // With instance for tracking
 * throw new RequestTimeoutException({
 *   title: 'Database Timeout',
 *   detail: 'Query execution exceeded time limit',
 *   instance: '/api/queries/123',
 * });
 */
export class RequestTimeoutException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Request Timeout', HttpStatus.REQUEST_TIMEOUT);
  }
}

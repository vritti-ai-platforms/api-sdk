import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when rate limiting is triggered (HTTP 429).
 * Used to prevent abuse and ensure fair resource usage.
 *
 * @example
 * // Simple message
 * throw new TooManyRequestsException('Too many requests');
 *
 * // With custom title and detail
 * throw new TooManyRequestsException({
 *   title: 'Rate Limit Exceeded',
 *   detail: 'You have exceeded the allowed number of requests',
 * });
 *
 * // With field errors
 * throw new TooManyRequestsException({
 *   title: 'API Throttled',
 *   detail: 'Too many requests to this endpoint',
 *   errors: [{ field: 'requests', message: 'Rate limit exceeded' }],
 * });
 *
 * // With instance and additional metadata
 * throw new TooManyRequestsException({
 *   detail: 'Rate limit exceeded',
 *   instance: '/api/v1/users',
 *   retryAfter: 60,
 *   limit: 100,
 *   remaining: 0,
 * });
 */
export class TooManyRequestsException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}

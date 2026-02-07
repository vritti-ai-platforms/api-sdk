import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when authentication is required or has failed (HTTP 401).
 *
 * @example
 * // Simple message
 * throw new UnauthorizedException('Authentication required');
 *
 * // With problem details
 * throw new UnauthorizedException({
 *   detail: 'Invalid or expired token',
 *   instance: '/api/auth/verify'
 * });
 */
export class UnauthorizedException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Unauthorized', HttpStatus.UNAUTHORIZED);
  }
}

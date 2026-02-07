import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when a feature or endpoint is not yet implemented (HTTP 501).
 * Used for planned but unavailable functionality.
 *
 * @example
 * // Simple message
 * throw new NotImplementedException('Feature not yet implemented');
 *
 * // With options
 * throw new NotImplementedException({
 *   detail: 'This feature is coming soon',
 *   instance: '/api/v1/export',
 * });
 */
export class NotImplementedException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Not Implemented', HttpStatus.NOT_IMPLEMENTED);
  }
}

import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when a requested resource cannot be found (HTTP 404).
 *
 * @example
 * // Simple message
 * throw new NotFoundException('Resource not found');
 *
 * // With custom label and detail
 * throw new NotFoundException({
 *   label: 'User Not Found',
 *   detail: 'The requested user does not exist',
 * });
 *
 * // With field errors
 * throw new NotFoundException({
 *   detail: 'The requested resource could not be located',
 *   errors: [{ field: 'userId', message: 'User does not exist' }],
 * });
 */
export class NotFoundException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Not Found', HttpStatus.NOT_FOUND);
  }
}

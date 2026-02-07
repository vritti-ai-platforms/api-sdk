import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when a request is malformed or contains invalid data (HTTP 400).
 *
 * @example
 * // Simple message
 * throw new BadRequestException('Invalid request data');
 *
 * // With field errors
 * throw new BadRequestException({
 *   detail: 'Validation failed',
 *   errors: [
 *     { field: 'email', message: 'Invalid email format' },
 *     { field: 'password', message: 'Password too short' }
 *   ]
 * });
 *
 * // With custom label and type
 * throw new BadRequestException({
 *   label: 'Invalid Form Data',
 *   detail: 'Please check your input',
 *   type: 'validation-error'
 * });
 */
export class BadRequestException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Bad Request', HttpStatus.BAD_REQUEST);
  }
}

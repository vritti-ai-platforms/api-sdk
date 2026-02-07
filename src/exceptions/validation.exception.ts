import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when request validation fails (HTTP 400).
 * Typically used for form validation or DTO validation errors.
 *
 * @example
 * // Simple message
 * throw new ValidationException('Validation failed');
 *
 * // With custom label and detail
 * throw new ValidationException({
 *   label: 'Invalid Input',
 *   detail: 'The provided data is invalid',
 * });
 *
 * // With field-specific errors
 * throw new ValidationException({
 *   detail: 'Please correct the highlighted fields',
 *   errors: [
 *     { field: 'email', message: 'Invalid email format' },
 *     { field: 'password', message: 'Password must be at least 8 characters' }
 *   ],
 * });
 *
 * // With custom label and field errors
 * throw new ValidationException({
 *   label: 'Form Validation Failed',
 *   detail: 'Please correct the highlighted fields',
 *   errors: [
 *     { field: 'email', message: 'Invalid email format' },
 *     { field: 'password', message: 'Password too weak' }
 *   ],
 * });
 */
export class ValidationException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Validation Failed', HttpStatus.BAD_REQUEST);
  }
}

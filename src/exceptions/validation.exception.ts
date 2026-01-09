import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when request validation fails (HTTP 400).
 * Typically used for form validation or DTO validation errors.
 *
 * @example
 * // Multiple validation errors
 * throw new ValidationException([
 *   { field: 'email', message: 'Invalid email format' },
 *   { field: 'password', message: 'Password must be at least 8 characters' }
 * ]);
 *
 * // With detail
 * throw new ValidationException(
 *   [{ field: 'email', message: 'Invalid format' }],
 *   'Please correct the errors and try again'
 * );
 */
export class ValidationException extends BaseFieldException {
  constructor(errors: FieldError[], detail?: string) {
    super(errors, HttpStatus.BAD_REQUEST, detail);
  }
}

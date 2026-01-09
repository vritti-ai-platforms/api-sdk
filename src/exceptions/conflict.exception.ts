import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when a request conflicts with the current state (HTTP 409).
 * Commonly used for duplicate resources or concurrent modification issues.
 *
 * @example
 * // Simple message
 * throw new ConflictException('Resource already exists');
 *
 * // Field-specific error
 * throw new ConflictException('email', 'Email already registered');
 *
 * // With detail
 * throw new ConflictException('email', 'Email already exists', 'Try logging in instead');
 *
 * // Multiple field errors
 * throw new ConflictException([
 *   { field: 'email', message: 'Email already in use' }
 * ]);
 */
export class ConflictException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.CONFLICT, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.CONFLICT, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.CONFLICT);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.CONFLICT);
    }
  }
}

import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when a request is malformed or contains invalid data (HTTP 400).
 *
 * @example
 * // Simple message
 * throw new BadRequestException('Invalid request data');
 *
 * // Field-specific error
 * throw new BadRequestException('email', 'Invalid email format');
 *
 * // With detail
 * throw new BadRequestException('email', 'Invalid email format', 'Email must be in valid format');
 *
 * // Multiple field errors
 * throw new BadRequestException([
 *   { field: 'email', message: 'Invalid email' },
 *   { field: 'password', message: 'Password too short' }
 * ]);
 */
export class BadRequestException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.BAD_REQUEST, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.BAD_REQUEST, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.BAD_REQUEST);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.BAD_REQUEST);
    }
  }
}

import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when a requested resource cannot be found (HTTP 404).
 *
 * @example
 * // Simple message
 * throw new NotFoundException('Resource not found');
 *
 * // Field-specific error
 * throw new NotFoundException('userId', 'User not found');
 *
 * // With detail
 * throw new NotFoundException('userId', 'User not found', 'No user exists with the provided ID');
 *
 * // Multiple field errors
 * throw new NotFoundException([
 *   { field: 'userId', message: 'User does not exist' }
 * ]);
 */
export class NotFoundException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.NOT_FOUND, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.NOT_FOUND, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.NOT_FOUND);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.NOT_FOUND);
    }
  }
}

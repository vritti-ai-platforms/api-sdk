import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when an unexpected server error occurs (HTTP 500).
 *
 * @example
 * // Simple message
 * throw new InternalServerErrorException('An unexpected error occurred');
 *
 * // Field-specific error
 * throw new InternalServerErrorException('database', 'Database connection failed');
 *
 * // With detail
 * throw new InternalServerErrorException('database', 'Connection failed', 'Please try again later');
 *
 * // Multiple field errors
 * throw new InternalServerErrorException([
 *   { field: 'system', message: 'Internal error' }
 * ]);
 */
export class InternalServerErrorException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.INTERNAL_SERVER_ERROR, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.INTERNAL_SERVER_ERROR, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.INTERNAL_SERVER_ERROR);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when content negotiation fails (HTTP 406).
 * Used when the server cannot produce a response matching the Accept headers.
 *
 * @example
 * // Simple message
 * throw new NotAcceptableException('Requested format not available');
 *
 * // Field-specific error
 * throw new NotAcceptableException('accept', 'Cannot produce response in requested format');
 *
 * // With detail
 * throw new NotAcceptableException('accept', 'Format not supported', 'Only JSON is available');
 *
 * // Multiple field errors
 * throw new NotAcceptableException([
 *   { field: 'contentType', message: 'XML format is not supported' }
 * ]);
 */
export class NotAcceptableException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.NOT_ACCEPTABLE, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.NOT_ACCEPTABLE, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.NOT_ACCEPTABLE);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.NOT_ACCEPTABLE);
    }
  }
}

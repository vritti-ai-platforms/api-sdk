import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when a request takes too long to process (HTTP 408).
 * Used when the client or server times out while waiting for completion.
 *
 * @example
 * // Simple message
 * throw new RequestTimeoutException('Request timeout');
 *
 * // Field-specific error
 * throw new RequestTimeoutException('operation', 'Operation timed out');
 *
 * // With detail
 * throw new RequestTimeoutException('query', 'Database query timeout', 'Try with fewer filters');
 *
 * // Multiple field errors
 * throw new RequestTimeoutException([
 *   { field: 'processing', message: 'Request took too long to complete' }
 * ]);
 */
export class RequestTimeoutException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.REQUEST_TIMEOUT, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.REQUEST_TIMEOUT, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.REQUEST_TIMEOUT);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.REQUEST_TIMEOUT);
    }
  }
}

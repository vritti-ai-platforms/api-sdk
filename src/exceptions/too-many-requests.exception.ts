import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when rate limiting is triggered (HTTP 429).
 * Used to prevent abuse and ensure fair resource usage.
 *
 * @example
 * // Simple message
 * throw new TooManyRequestsException('Too many requests');
 *
 * // Field-specific error
 * throw new TooManyRequestsException('api', 'Rate limit exceeded');
 *
 * // With detail
 * throw new TooManyRequestsException('api', 'Rate limit exceeded', 'Try again in 60 seconds');
 *
 * // Multiple field errors
 * throw new TooManyRequestsException([
 *   { field: 'requests', message: 'Rate limit exceeded for this endpoint' }
 * ]);
 */
export class TooManyRequestsException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.TOO_MANY_REQUESTS, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.TOO_MANY_REQUESTS, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.TOO_MANY_REQUESTS);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}

import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when request payload exceeds size limits (HTTP 413).
 * Commonly used for file upload size restrictions or large request bodies.
 *
 * @example
 * // Simple message
 * throw new PayloadTooLargeException('Request payload too large');
 *
 * // Field-specific error
 * throw new PayloadTooLargeException('file', 'File size exceeds maximum allowed');
 *
 * // With detail
 * throw new PayloadTooLargeException('file', 'File too large', 'Maximum size is 10MB');
 *
 * // Multiple field errors
 * throw new PayloadTooLargeException([
 *   { field: 'upload', message: 'File exceeds 10MB limit' }
 * ]);
 */
export class PayloadTooLargeException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.PAYLOAD_TOO_LARGE, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.PAYLOAD_TOO_LARGE, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.PAYLOAD_TOO_LARGE);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.PAYLOAD_TOO_LARGE);
    }
  }
}

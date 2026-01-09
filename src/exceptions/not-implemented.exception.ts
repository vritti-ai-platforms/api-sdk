import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when a feature or endpoint is not yet implemented (HTTP 501).
 * Used for planned but unavailable functionality.
 *
 * @example
 * // Simple message
 * throw new NotImplementedException('Feature not yet implemented');
 *
 * // Field-specific error
 * throw new NotImplementedException('feature', 'This feature is coming soon');
 *
 * // With detail
 * throw new NotImplementedException('export', 'Not implemented', 'PDF export will be available in v2.0');
 *
 * // Multiple field errors
 * throw new NotImplementedException([
 *   { field: 'functionality', message: 'This functionality is not available yet' }
 * ]);
 */
export class NotImplementedException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.NOT_IMPLEMENTED, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.NOT_IMPLEMENTED, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.NOT_IMPLEMENTED);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.NOT_IMPLEMENTED);
    }
  }
}

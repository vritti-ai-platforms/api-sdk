import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when a resource has been permanently removed (HTTP 410).
 * Unlike 404, this indicates the resource existed but is intentionally gone.
 *
 * @example
 * // Simple message
 * throw new GoneException('Resource permanently deleted');
 *
 * // Field-specific error
 * throw new GoneException('account', 'Account has been permanently deleted');
 *
 * // With detail
 * throw new GoneException('account', 'Deleted', 'This account was removed on user request');
 *
 * // Multiple field errors
 * throw new GoneException([
 *   { field: 'resource', message: 'This content has been permanently removed' }
 * ]);
 */
export class GoneException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.GONE, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.GONE, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.GONE);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.GONE);
    }
  }
}

import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when the user does not have permission to access a resource (HTTP 403).
 *
 * @example
 * // Simple message
 * throw new ForbiddenException('Access denied');
 *
 * // Field-specific error
 * throw new ForbiddenException('resource', 'You do not have permission');
 *
 * // With detail
 * throw new ForbiddenException('resource', 'Access denied', 'Admin role required');
 *
 * // Multiple field errors
 * throw new ForbiddenException([
 *   { field: 'action', message: 'Insufficient permissions' }
 * ]);
 */
export class ForbiddenException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.FORBIDDEN, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.FORBIDDEN, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.FORBIDDEN);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.FORBIDDEN);
    }
  }
}

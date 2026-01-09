import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when authentication is required or has failed (HTTP 401).
 *
 * @example
 * // Simple message
 * throw new UnauthorizedException('Authentication required');
 *
 * // Field-specific error
 * throw new UnauthorizedException('token', 'Invalid or expired token');
 *
 * // With detail
 * throw new UnauthorizedException('token', 'Invalid token', 'Please login again');
 *
 * // Multiple field errors
 * throw new UnauthorizedException([
 *   { field: 'token', message: 'Token expired' }
 * ]);
 */
export class UnauthorizedException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.UNAUTHORIZED, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.UNAUTHORIZED, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.UNAUTHORIZED);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.UNAUTHORIZED);
    }
  }
}

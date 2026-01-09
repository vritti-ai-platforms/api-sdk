import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when an HTTP method is not supported for the endpoint (HTTP 405).
 * For example, when a POST is sent to a GET-only endpoint.
 *
 * @example
 * // Simple message
 * throw new MethodNotAllowedException('Method not allowed');
 *
 * // Field-specific error
 * throw new MethodNotAllowedException('method', 'POST method not allowed on this endpoint');
 *
 * // With detail
 * throw new MethodNotAllowedException('method', 'Not allowed', 'Only GET and PUT are supported');
 *
 * // Multiple field errors
 * throw new MethodNotAllowedException([
 *   { field: 'method', message: 'DELETE is not allowed on this resource' }
 * ]);
 */
export class MethodNotAllowedException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.METHOD_NOT_ALLOWED, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.METHOD_NOT_ALLOWED, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.METHOD_NOT_ALLOWED);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.METHOD_NOT_ALLOWED);
    }
  }
}

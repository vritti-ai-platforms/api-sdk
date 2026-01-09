import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when the request is well-formed but contains semantic errors (HTTP 422).
 * Used for business logic validation failures that prevent processing.
 *
 * @example
 * // Simple message
 * throw new UnprocessableEntityException('Cannot process the request');
 *
 * // Field-specific error
 * throw new UnprocessableEntityException('age', 'Age must be 18 or older');
 *
 * // With detail
 * throw new UnprocessableEntityException('quantity', 'Insufficient stock', 'Only 5 items available');
 *
 * // Multiple field errors
 * throw new UnprocessableEntityException([
 *   { field: 'startDate', message: 'Start date must be before end date' },
 *   { field: 'endDate', message: 'End date cannot be in the past' }
 * ]);
 */
export class UnprocessableEntityException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.UNPROCESSABLE_ENTITY, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.UNPROCESSABLE_ENTITY, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.UNPROCESSABLE_ENTITY);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }
}

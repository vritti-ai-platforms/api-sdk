import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when the request is well-formed but contains semantic errors (HTTP 422).
 * Used for business logic validation failures that prevent processing.
 *
 * @example
 * // Simple message
 * throw new UnprocessableEntityException('Cannot process the request');
 *
 * // With detail
 * throw new UnprocessableEntityException({
 *   detail: 'Cannot process the order due to stock limitations',
 * });
 *
 * // With custom title
 * throw new UnprocessableEntityException({
 *   title: 'Business Rule Violation',
 *   detail: 'Cannot process the order due to stock limitations',
 * });
 *
 * // With field errors
 * throw new UnprocessableEntityException({
 *   detail: 'One or more items exceed available inventory',
 *   errors: [{ field: 'quantity', message: 'Insufficient stock available' }],
 * });
 *
 * // With custom title and field errors
 * throw new UnprocessableEntityException({
 *   title: 'Validation Failed',
 *   detail: 'One or more items exceed available inventory',
 *   errors: [{ field: 'quantity', message: 'Insufficient stock available' }],
 * });
 */
export class UnprocessableEntityException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Unprocessable Entity', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

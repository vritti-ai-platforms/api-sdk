import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when a request conflicts with the current state (HTTP 409).
 * Commonly used for duplicate resources or concurrent modification issues.
 *
 * @example
 * // Simple detail message
 * throw new ConflictException('Resource already exists');
 *
 * // With custom label and detail
 * throw new ConflictException({
 *   label: 'Duplicate Entry',
 *   detail: 'Email already exists',
 * });
 *
 * // With field-specific errors
 * throw new ConflictException({
 *   detail: 'Duplicate data detected',
 *   errors: [
 *     { field: 'email', message: 'Email already registered' }
 *   ],
 * });
 *
 * // With custom label and field errors
 * throw new ConflictException({
 *   label: 'Resource Conflict',
 *   detail: 'Try logging in instead or use a different email',
 *   errors: [{ field: 'email', message: 'Email already in use' }],
 * });
 */
export class ConflictException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Conflict', HttpStatus.CONFLICT);
  }
}

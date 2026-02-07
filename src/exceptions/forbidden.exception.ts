import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when the user does not have permission to access a resource (HTTP 403).
 *
 * @example
 * // Simple detail message
 * throw new ForbiddenException('Access denied');
 *
 * // With custom label
 * throw new ForbiddenException({
 *   label: 'Access Denied',
 *   detail: 'You do not have permission to perform this action',
 * });
 *
 * // With field-specific errors
 * throw new ForbiddenException({
 *   label: 'Permission Denied',
 *   detail: 'Contact your administrator for access',
 *   errors: [{ field: 'role', message: 'Admin role required' }],
 * });
 */
export class ForbiddenException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Forbidden', HttpStatus.FORBIDDEN);
  }
}

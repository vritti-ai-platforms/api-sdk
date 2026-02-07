import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when a resource has been permanently removed (HTTP 410).
 * Unlike 404, this indicates the resource existed but is intentionally gone.
 *
 * @example
 * // Simple message
 * throw new GoneException('Resource permanently deleted');
 *
 * // With label and detail
 * throw new GoneException({
 *   label: 'Account Deleted',
 *   detail: 'This account has been permanently removed',
 * });
 *
 * // With field errors
 * throw new GoneException({
 *   label: 'Resource Removed',
 *   detail: 'The resource was removed due to policy violation',
 *   errors: [{ field: 'resource', message: 'This content has been permanently deleted' }],
 * });
 */
export class GoneException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Gone', HttpStatus.GONE);
  }
}

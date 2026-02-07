import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when an unexpected server error occurs (HTTP 500).
 *
 * @example
 * // Simple message
 * throw new InternalServerErrorException('An unexpected error occurred');
 *
 * // With options object
 * throw new InternalServerErrorException({
 *   title: 'Server Error',
 *   detail: 'Something went wrong',
 *   instance: '/api/users',
 * });
 */
export class InternalServerErrorException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when an HTTP method is not supported for the endpoint (HTTP 405).
 * For example, when a POST is sent to a GET-only endpoint.
 *
 * @example
 * // Simple message
 * throw new MethodNotAllowedException('Method not allowed');
 *
 * // With detail
 * throw new MethodNotAllowedException({
 *   detail: 'Method not allowed',
 *   instance: '/api/resource/123'
 * });
 *
 * // With custom title
 * throw new MethodNotAllowedException({
 *   title: 'Invalid HTTP Method',
 *   detail: 'This endpoint only supports GET requests',
 * });
 *
 * // With additional context
 * throw new MethodNotAllowedException({
 *   title: 'Unsupported Operation',
 *   detail: 'PATCH is not supported for this resource',
 *   instance: '/api/users/456',
 *   extensions: { allowedMethods: ['GET', 'PUT', 'DELETE'] }
 * });
 */
export class MethodNotAllowedException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Method Not Allowed', HttpStatus.METHOD_NOT_ALLOWED);
  }
}

import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when request payload exceeds size limits (HTTP 413).
 * Commonly used for file upload size restrictions or large request bodies.
 *
 * @example
 * // Simple message
 * throw new PayloadTooLargeException('Request payload too large');
 *
 * // With detail
 * throw new PayloadTooLargeException({
 *   detail: 'Request payload too large',
 *   instance: '/api/upload',
 * });
 *
 * // With custom title
 * throw new PayloadTooLargeException({
 *   title: 'File Size Limit Exceeded',
 *   detail: 'The uploaded file is too large. Maximum size is 10MB',
 *   instance: '/api/files/upload',
 * });
 */
export class PayloadTooLargeException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Payload Too Large', HttpStatus.PAYLOAD_TOO_LARGE);
  }
}

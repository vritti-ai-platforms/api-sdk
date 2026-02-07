import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when content negotiation fails (HTTP 406).
 * Used when the server cannot produce a response matching the Accept headers.
 *
 * @example
 * // Simple detail message
 * throw new NotAcceptableException('Requested format not available');
 *
 * // With custom label
 * throw new NotAcceptableException({
 *   label: 'Content Negotiation Failed',
 *   detail: 'Cannot produce response in the requested format',
 * });
 *
 * // With field-specific errors
 * throw new NotAcceptableException({
 *   detail: 'Requested format is not supported',
 *   errors: [
 *     { field: 'accept', message: 'XML format is not available' },
 *     { field: 'contentType', message: 'Only JSON is supported' },
 *   ],
 * });
 *
 * // With all options
 * throw new NotAcceptableException({
 *   type: 'https://api.example.com/errors/format-not-supported',
 *   label: 'Unsupported Media Type',
 *   detail: 'This API only supports JSON responses',
 *   errors: [{ field: 'accept', message: 'XML format is not available' }],
 * });
 */
export class NotAcceptableException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Not Acceptable', HttpStatus.NOT_ACCEPTABLE);
  }
}

import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when the media type of the request is not supported (HTTP 415).
 * Used when the Content-Type header specifies an unsupported format.
 *
 * @example
 * // Simple message
 * throw new UnsupportedMediaTypeException('Unsupported media type');
 *
 * // With label and detail
 * throw new UnsupportedMediaTypeException({
 *   label: 'Invalid Content Type',
 *   detail: 'The content type is not supported',
 * });
 *
 * // With field errors
 * throw new UnsupportedMediaTypeException({
 *   label: 'Unsupported File Format',
 *   detail: 'Accepted formats: JPEG, PNG, GIF',
 *   errors: [{ field: 'file', message: 'PDF format is not accepted for this upload' }],
 * });
 */
export class UnsupportedMediaTypeException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Unsupported Media Type', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  }
}

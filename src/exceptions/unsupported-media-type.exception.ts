import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when the media type of the request is not supported (HTTP 415).
 * Used when the Content-Type header specifies an unsupported format.
 *
 * @example
 * // Simple message
 * throw new UnsupportedMediaTypeException('Unsupported media type');
 *
 * // Field-specific error
 * throw new UnsupportedMediaTypeException('contentType', 'XML is not supported');
 *
 * // With detail
 * throw new UnsupportedMediaTypeException('contentType', 'Not supported', 'Only JSON and form-data are accepted');
 *
 * // Multiple field errors
 * throw new UnsupportedMediaTypeException([
 *   { field: 'contentType', message: 'application/xml is not supported' }
 * ]);
 */
export class UnsupportedMediaTypeException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.UNSUPPORTED_MEDIA_TYPE, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.UNSUPPORTED_MEDIA_TYPE, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
  }
}

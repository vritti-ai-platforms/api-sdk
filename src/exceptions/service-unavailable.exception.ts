import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when the service is temporarily unavailable (HTTP 503).
 * Used during maintenance, overload, or temporary outages.
 *
 * @example
 * // Simple message
 * throw new ServiceUnavailableException('Service temporarily unavailable');
 *
 * // Field-specific error
 * throw new ServiceUnavailableException('service', 'Scheduled maintenance in progress');
 *
 * // With detail
 * throw new ServiceUnavailableException('service', 'Maintenance', 'Service will be back at 2 PM EST');
 *
 * // Multiple field errors
 * throw new ServiceUnavailableException([
 *   { field: 'database', message: 'Database is temporarily unavailable' }
 * ]);
 */
export class ServiceUnavailableException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.SERVICE_UNAVAILABLE, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.SERVICE_UNAVAILABLE, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.SERVICE_UNAVAILABLE);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}

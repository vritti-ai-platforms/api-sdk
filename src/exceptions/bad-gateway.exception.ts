import { HttpStatus } from '@nestjs/common';
import { BaseFieldException, type FieldError } from './base-field.exception';

/**
 * Exception thrown when a gateway or proxy receives an invalid response (HTTP 502).
 * Used when a server acting as a gateway gets an error from an upstream server.
 *
 * @example
 * // Simple message
 * throw new BadGatewayException('Bad gateway');
 *
 * // Field-specific error
 * throw new BadGatewayException('upstream', 'Upstream service returned invalid response');
 *
 * // With detail
 * throw new BadGatewayException('proxy', 'Gateway error', 'Payment service is not responding correctly');
 *
 * // Multiple field errors
 * throw new BadGatewayException([
 *   { field: 'gateway', message: 'Invalid response from upstream server' }
 * ]);
 */
export class BadGatewayException extends BaseFieldException {
  constructor(messageOrField: string | FieldError[], fieldMessageOrDetail?: string, detail?: string) {
    if (Array.isArray(messageOrField)) {
      // (errors: FieldError[], detail?: string)
      super(messageOrField, HttpStatus.BAD_GATEWAY, fieldMessageOrDetail);
    } else if (detail !== undefined) {
      // (field: string, message: string, detail: string)
      super(messageOrField, fieldMessageOrDetail!, HttpStatus.BAD_GATEWAY, detail);
    } else if (fieldMessageOrDetail) {
      // (field: string, message: string)
      super(messageOrField, fieldMessageOrDetail, HttpStatus.BAD_GATEWAY);
    } else {
      // (message: string)
      super(messageOrField, HttpStatus.BAD_GATEWAY);
    }
  }
}

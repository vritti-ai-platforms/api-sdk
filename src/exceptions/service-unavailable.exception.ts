import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when the service is temporarily unavailable (HTTP 503).
 * Used during maintenance, overload, or temporary outages.
 *
 * @example
 * // Simple message
 * throw new ServiceUnavailableException('Service temporarily unavailable');
 *
 * // With custom title and detail
 * throw new ServiceUnavailableException({
 *   title: 'Scheduled Maintenance',
 *   detail: 'Expected completion: 2 PM EST',
 * });
 *
 * // With field errors
 * throw new ServiceUnavailableException({
 *   title: 'External Service Unavailable',
 *   detail: 'Payment service is down',
 *   errors: [{ field: 'paymentGateway', message: 'Payment gateway unavailable' }],
 * });
 */
export class ServiceUnavailableException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Service Unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }
}

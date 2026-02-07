import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

/**
 * Exception thrown when a gateway or proxy receives an invalid response (HTTP 502).
 * Used when a server acting as a gateway gets an error from an upstream server.
 *
 * @example
 * // Simple message
 * throw new BadGatewayException('Upstream service returned invalid response');
 *
 * // With options
 * throw new BadGatewayException({
 *   title: 'Upstream Service Error',
 *   detail: 'The payment service is not responding correctly',
 *   instance: '/api/payments/process',
 * });
 */
export class BadGatewayException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Bad Gateway', HttpStatus.BAD_GATEWAY);
  }
}

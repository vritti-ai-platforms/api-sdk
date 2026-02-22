import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

export class PayloadTooLargeException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Payload Too Large', HttpStatus.PAYLOAD_TOO_LARGE);
  }
}

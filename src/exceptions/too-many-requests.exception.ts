import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

export class TooManyRequestsException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}

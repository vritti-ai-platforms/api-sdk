import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

export class MethodNotAllowedException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Method Not Allowed', HttpStatus.METHOD_NOT_ALLOWED);
  }
}

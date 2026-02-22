import { HttpStatus } from '@nestjs/common';
import { HttpProblemException, type ProblemOptions } from './base-field.exception';

export class UnsupportedMediaTypeException extends HttpProblemException {
  constructor(detailOrOptions?: string | ProblemOptions) {
    super(detailOrOptions ?? 'Unsupported Media Type', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  }
}

import type { ProblemOptions } from './base-field.exception';
import { BadRequestException } from './bad-request.exception';

export class InvalidCursorException extends BadRequestException {
  constructor(detail = 'The pagination cursor is invalid.') {
    super({ label: 'Invalid cursor', detail } satisfies ProblemOptions);
  }
}

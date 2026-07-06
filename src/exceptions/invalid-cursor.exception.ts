import type { ProblemOptions } from './base-field.exception';
import { BadRequestException } from './bad-request.exception';

// A pagination cursor that is malformed, fails its integrity (HMAC) check, or was minted for a
// different sort than the current request. Surfaces as an RFC 9457 400 rather than an unhandled 500.
export class InvalidCursorException extends BadRequestException {
  constructor(detail = 'The pagination cursor is invalid.') {
    super({ label: 'Invalid cursor', detail } satisfies ProblemOptions);
  }
}

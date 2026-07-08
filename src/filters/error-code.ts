import { HttpStatus } from '@nestjs/common';

export enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL = 'INTERNAL',
}

// Maps an HTTP status code to the canonical ErrorCode so HTTP and GraphQL classify identically.
export function errorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.UNAUTHORIZED: // 401
      return ErrorCode.UNAUTHENTICATED;
    case HttpStatus.FORBIDDEN: // 403
      return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND: // 404
      return ErrorCode.NOT_FOUND;
    case HttpStatus.BAD_REQUEST: // 400
    case HttpStatus.UNPROCESSABLE_ENTITY: // 422
      return ErrorCode.VALIDATION_FAILED;
    case HttpStatus.CONFLICT: // 409
      return ErrorCode.CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS: // 429
      return ErrorCode.RATE_LIMITED;
    default:
      // Any other 4xx is a generic bad request; 5xx and unknown collapse to INTERNAL.
      if (status >= 400 && status < 500) {
        return ErrorCode.BAD_REQUEST;
      }
      return ErrorCode.INTERNAL;
  }
}

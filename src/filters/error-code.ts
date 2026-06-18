import { HttpStatus } from '@nestjs/common';

// Machine-readable error contract surfaced on the wire as `extensions.code` (GraphQL) so clients
// branch on a stable enum instead of HTTP status codes or human-readable messages. This is a plain
// TypeScript enum today; registering it as a GraphQL schema enum is a later client-codegen concern.
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

// Maps an HTTP status code to the canonical ErrorCode. Keeps the GraphQL `extensions.code` aligned
// with the same status the RFC 9457 HTTP filter would emit, so both transports classify identically.
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
      // Any other client error (4xx) is a generic bad request; everything else
      // (5xx and unknown/non-numeric) collapses to INTERNAL.
      if (status >= 400 && status < 500) {
        return ErrorCode.BAD_REQUEST;
      }
      return ErrorCode.INTERNAL;
  }
}

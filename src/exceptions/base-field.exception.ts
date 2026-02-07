import { HttpException, HttpStatus } from '@nestjs/common';
import type { FieldError } from '../types/error-response.types';

// Re-export FieldError for backwards compatibility
export type { FieldError } from '../types/error-response.types';

/**
 * Options for creating RFC 9457 Problem Details exceptions.
 *
 * @example
 * throw new UnauthorizedException({
 *   label: 'Invalid Credentials',
 *   detail: 'The email or password is incorrect',
 * });
 *
 * @example
 * throw new BadRequestException({
 *   detail: 'Validation failed',
 *   errors: [
 *     { field: 'email', message: 'Invalid email format' },
 *     { field: 'password', message: 'Password too short' },
 *   ],
 * });
 */
export interface ProblemOptions {
  /** Problem type URI (default: "about:blank") */
  type?: string;
  /** Root error heading (maps to AlertTitle in frontend) */
  label?: string;
  /** Root error description (maps to AlertDescription in frontend) */
  detail?: string;
  /** Field-specific errors only (field is required) */
  errors?: FieldError[];
}

/**
 * Base exception class that follows RFC 9457 Problem Details format.
 *
 * Provides a clean interface for creating HTTP exceptions with:
 * - RFC 9457 standard fields (type, title, status, detail, instance)
 * - Extension members (label for root error heading, errors for field-specific errors)
 *
 * The `title` field is always set to the HTTP status phrase (e.g., "Unauthorized")
 * by the HttpExceptionFilter, not by this class.
 */
export abstract class HttpProblemException extends HttpException {
  constructor(detailOrOptions: string | ProblemOptions, httpStatus: HttpStatus) {
    const options = typeof detailOrOptions === 'string' ? { detail: detailOrOptions } : detailOrOptions;

    super(
      {
        type: options.type ?? 'about:blank',
        label: options.label,
        detail: options.detail,
        errors: options.errors ?? [],
      },
      httpStatus,
    );
  }
}

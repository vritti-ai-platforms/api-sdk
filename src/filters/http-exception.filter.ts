import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { ApiErrorResponse, FieldError } from '../types/error-response.types';

/**
 * Shape of exception response from custom field exceptions (BaseFieldException).
 */
interface FieldExceptionResponse {
  errors: FieldError[];
  detail?: string;
}

/**
 * Shape of exception response from class-validator validation errors.
 */
interface ValidationExceptionResponse {
  message: Array<string | { property: string; constraints: Record<string, string> }>;
  error?: string;
}

/**
 * Shape of standard NestJS exception response.
 */
interface StandardExceptionResponse {
  message: string | string[];
  error?: string;
}

/**
 * Union type for all possible exception response shapes.
 */
type ExceptionResponseObject = FieldExceptionResponse | ValidationExceptionResponse | StandardExceptionResponse;

/**
 * Converts an HTTP status code to its corresponding title string.
 * Uses the HttpStatus enum to map status codes to human-readable titles.
 *
 * @param status - The HTTP status code
 * @returns The human-readable title for the status code
 *
 * @example
 * getHttpStatusTitle(400) // Returns: "Bad Request"
 * getHttpStatusTitle(404) // Returns: "Not Found"
 * getHttpStatusTitle(500) // Returns: "Internal Server Error"
 */
export function getHttpStatusTitle(status: number): string {
  // Find the enum key for the given status code
  const enumKey = Object.entries(HttpStatus).find(([key, value]) => value === status && Number.isNaN(Number(key)))?.[0];

  if (!enumKey) {
    return 'Error';
  }

  // Convert enum key to title case (e.g., BAD_REQUEST -> Bad Request)
  return enumKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Global HTTP Exception Filter implementing RFC 7807 Problem Details
 *
 * Transforms all exceptions into a standardized RFC 7807 format:
 * {
 *   title: string,        // Human-readable status title
 *   status: number,       // HTTP status code
 *   detail: string,       // Detailed error description
 *   errors: FieldError[]  // Field-specific error messages
 * }
 *
 * Handles:
 * - Custom field exceptions from @vritti/api-sdk (BaseFieldException)
 * - Class-validator DTO validation errors
 * - Standard NestJS HTTP exceptions
 * - Unknown errors
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errors: FieldError[] = [];
    let detail = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as ExceptionResponseObject;

        // Handle custom field exceptions from @vritti/api-sdk
        if ('errors' in responseObj && Array.isArray(responseObj.errors)) {
          errors = responseObj.errors;
          detail = ('detail' in responseObj ? responseObj.detail : undefined) || exception.message;
        }
        // Handle class-validator DTO validation errors
        else if ('message' in responseObj && Array.isArray(responseObj.message)) {
          errors = responseObj.message.map((msg) => {
            if (typeof msg === 'object' && 'property' in msg && 'constraints' in msg) {
              const constraintValues = Object.values(msg.constraints);
              return {
                field: msg.property,
                message: constraintValues[0] ?? 'Validation failed',
              };
            }
            return { message: typeof msg === 'string' ? msg : JSON.stringify(msg) };
          });
          detail = 'Validation failed';
        }
        // Handle standard NestJS exceptions
        else if ('message' in responseObj) {
          const message = responseObj.message;
          errors = [{ message: Array.isArray(message) ? message.join(', ') : message }];
          detail = ('error' in responseObj ? responseObj.error : undefined) || exception.message;
        }
      } else if (typeof exceptionResponse === 'string') {
        errors = [{ message: exceptionResponse }];
        detail = exceptionResponse;
      }
    } else {
      // Unknown errors
      const errorMessage = exception instanceof Error ? exception.message : 'Unknown error';
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`Unexpected error: ${errorMessage}`, stack);
      errors = [{ message: 'An unexpected error occurred' }];
    }

    const problemDetails: ApiErrorResponse = {
      title: getHttpStatusTitle(status),
      status,
      detail,
      errors,
    };

    response.status(status).send(problemDetails);
  }
}

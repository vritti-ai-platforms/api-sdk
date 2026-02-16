import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse, FieldError } from '../types/error-response.types';

/**
 * Shape of exception response from custom HttpProblemException.
 */
interface ProblemExceptionResponse {
  type?: string;
  label?: string;
  detail?: string;
  errors?: FieldError[];
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
type ExceptionResponseObject = ProblemExceptionResponse | ValidationExceptionResponse | StandardExceptionResponse;

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
 * Global HTTP Exception Filter implementing RFC 9457 Problem Details
 *
 * Transforms all exceptions into a standardized RFC 9457 format:
 * {
 *   type: string,         // Problem type URI (default: "about:blank")
 *   title: string,        // HTTP status phrase (e.g., "Unauthorized")
 *   status: number,       // HTTP status code
 *   label?: string,       // Root error heading (maps to AlertTitle)
 *   detail: string,       // Root error description (maps to AlertDescription)
 *   instance: string,     // Request path
 *   errors: FieldError[]  // Field-specific errors (field is required)
 * }
 *
 * Handles:
 * - Custom HttpProblemException from @vritti/api-sdk
 * - Class-validator DTO validation errors
 * - Standard NestJS HTTP exceptions
 * - Unknown errors
 */
/**
 * Duck-type check for HttpException to handle cross-package instanceof failures.
 * When @vritti/api-sdk is symlinked, the consumer's @nestjs/common may be a different
 * instance, causing instanceof HttpException to return false.
 */
function isHttpException(exception: unknown): exception is HttpException {
  return (
    exception instanceof HttpException ||
    (typeof exception === 'object' &&
      exception !== null &&
      typeof (exception as any).getStatus === 'function' &&
      typeof (exception as any).getResponse === 'function')
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let type = 'about:blank';
    let label: string | undefined;
    let detail = 'Internal server error';
    let errors: FieldError[] = [];

    if (isHttpException(exception)) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as ExceptionResponseObject;

        // Handle custom HttpProblemException from @vritti/api-sdk
        if ('type' in responseObj || 'label' in responseObj || 'errors' in responseObj) {
          const problemResponse = responseObj as ProblemExceptionResponse;
          type = problemResponse.type ?? 'about:blank';
          label = problemResponse.label;
          detail = problemResponse.detail ?? exception.message ?? getHttpStatusTitle(status);
          errors = problemResponse.errors ?? [];
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
            // Non-field-specific validation messages are ignored
            // They should be handled as detail at the response level
            return null;
          }).filter((error): error is FieldError => error !== null);
          detail = 'Validation failed';
        }
        // Handle standard NestJS exceptions
        else if ('message' in responseObj) {
          const message = responseObj.message;
          detail = Array.isArray(message) ? message.join(', ') : message;
        }
      } else if (typeof exceptionResponse === 'string') {
        detail = exceptionResponse;
      }
    } else {
      // Unknown errors
      const errorMessage = exception instanceof Error ? exception.message : 'Unknown error';
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`Unexpected error: ${errorMessage}`, stack);
      detail = 'An unexpected error occurred';
    }

    const problemDetails: ApiErrorResponse = {
      type,
      title: getHttpStatusTitle(status),
      status,
      ...(label && { label }),
      detail,
      instance: request.url,
      errors,
    };

    response
      .header('Content-Type', 'application/problem+json')
      .status(status)
      .send(problemDetails);
  }
}

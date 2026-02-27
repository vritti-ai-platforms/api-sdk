import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse, FieldError } from '../types/error-response.types';

interface ProblemExceptionResponse {
  type?: string;
  label?: string;
  detail?: string;
  errors?: FieldError[];
}

interface ValidationExceptionResponse {
  message: Array<string | { property: string; constraints: Record<string, string> }>;
  error?: string;
}

interface StandardExceptionResponse {
  message: string | string[];
  error?: string;
}

type ExceptionResponseObject = ProblemExceptionResponse | ValidationExceptionResponse | StandardExceptionResponse;

// Converts an HTTP status code to its title string (e.g., 400 → "Bad Request")
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

    if (exception instanceof HttpException) {
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
    } else if (this.isAxiosError(exception)) {
      // Outgoing HTTP call failures (e.g., service-to-service calls)
      const axiosStatus = exception.response?.status;
      const axiosDetail = exception.response?.data?.message || exception.response?.data?.detail || exception.message;
      const url = exception.config?.url;
      status = HttpStatus.BAD_GATEWAY;
      detail = `Upstream service error${axiosStatus ? ` (${axiosStatus})` : ''}: ${axiosDetail}`;
      this.logger.error(`Upstream API error [${axiosStatus}]: ${axiosDetail} — URL: ${url}`, exception.stack);
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

  // Duck-type check for AxiosError without importing axios
  private isAxiosError(
    error: unknown,
  ): error is Error & {
    isAxiosError: true;
    response?: { status?: number; data?: Record<string, unknown> };
    config?: { url?: string };
  } {
    return error instanceof Error && (error as { isAxiosError?: boolean }).isAxiosError === true;
  }
}

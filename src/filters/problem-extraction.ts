import { HttpStatus } from '@nestjs/common';
import type { FieldError } from '../types/error-response.types';

// Shape of the @vritti/api-sdk HttpProblemException response body (type/label/detail/errors[]).
interface ProblemExceptionResponse {
  type?: string;
  label?: string;
  detail?: string;
  errors?: FieldError[];
}

// Shape of a class-validator ValidationPipe error body (message is an array of constraints).
interface ValidationExceptionResponse {
  message: Array<string | { property: string; constraints: Record<string, string> }>;
  error?: string;
}

// Shape of a standard NestJS exception body (message is a string or string[]).
interface StandardExceptionResponse {
  message: string | string[];
  error?: string;
}

type ExceptionResponseObject = ProblemExceptionResponse | ValidationExceptionResponse | StandardExceptionResponse;

// Normalized problem information extracted from a NestJS HttpException's response body.
// Shared by HttpExceptionFilter (RFC 9457 HTTP responses) and the GraphQL formatError so the
// SAME label/detail/field-errors surface across both transports. `detail` is undefined when the
// response body carried no usable detail, letting each caller apply its own fallback.
export interface ExtractedProblem {
  type: string;
  label?: string;
  detail?: string;
  errors: FieldError[];
}

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

// Extracts field-specific errors from a class-validator ValidationPipe message array. Mirrors the
// RFC 9457 errors[] that the HTTP filter produces so GraphQL fieldErrors carry the same info.
function extractValidationFieldErrors(
  message: Array<string | { property: string; constraints: Record<string, string> }>,
): FieldError[] {
  return message
    .map((msg) => {
      if (typeof msg === 'object' && 'property' in msg && 'constraints' in msg) {
        const constraintValues = Object.values(msg.constraints);
        return {
          field: msg.property,
          message: constraintValues[0] ?? 'Validation failed',
        };
      }
      // Non-field-specific validation messages are ignored here; they belong at the detail level.
      return null;
    })
    .filter((error): error is FieldError => error !== null);
}

// Parses a NestJS HttpException response body into normalized problem fields. Handles the three
// body shapes the SDK encounters: custom HttpProblemException, class-validator errors, and
// standard NestJS exceptions. `problemFallbackDetail` supplies the detail for the
// HttpProblemException branch when its body omits one (mirrors the HTTP filter's prior
// `problemResponse.detail ?? exception.message ?? title`). `detail` is left undefined for an
// object body that matches no known shape, so the caller keeps its own initial detail.
export function extractProblemFromResponse(
  exceptionResponse: string | object,
  problemFallbackDetail: string,
): ExtractedProblem {
  let type = 'about:blank';
  let label: string | undefined;
  let detail: string | undefined;
  let errors: FieldError[] = [];

  if (typeof exceptionResponse === 'string') {
    detail = exceptionResponse;
    return { type, label, detail, errors };
  }

  if (exceptionResponse !== null && typeof exceptionResponse === 'object') {
    const responseObj = exceptionResponse as ExceptionResponseObject;

    // Custom HttpProblemException from @vritti/api-sdk
    if ('type' in responseObj || 'label' in responseObj || 'errors' in responseObj) {
      const problemResponse = responseObj as ProblemExceptionResponse;
      type = problemResponse.type ?? 'about:blank';
      label = problemResponse.label;
      detail = problemResponse.detail ?? problemFallbackDetail;
      errors = problemResponse.errors ?? [];
    }
    // class-validator DTO validation errors
    else if ('message' in responseObj && Array.isArray(responseObj.message)) {
      errors = extractValidationFieldErrors(responseObj.message);
      detail = 'Validation failed';
    }
    // Standard NestJS exceptions
    else if ('message' in responseObj) {
      const message = (responseObj as StandardExceptionResponse).message;
      detail = Array.isArray(message) ? message.join(', ') : message;
    }
  }

  return { type, label, detail, errors };
}

import { HttpException, HttpStatus } from '@nestjs/common';
import type { FieldError } from '../types/error-response.types';

// Re-export FieldError for backwards compatibility
export type { FieldError } from '../types/error-response.types';

export abstract class BaseFieldException extends HttpException {
  constructor(
    statusOrMessageOrErrors: HttpStatus | string | FieldError[],
    messageOrStatus?: string | HttpStatus,
    statusOrDetail?: HttpStatus | string,
    detail?: string
  ) {
    let errors: FieldError[];
    let httpStatus: HttpStatus;
    let finalDetail: string | undefined;

    if (Array.isArray(statusOrMessageOrErrors)) {
      // (errors: FieldError[], httpStatus: HttpStatus, detail?: string)
      errors = statusOrMessageOrErrors;
      httpStatus = messageOrStatus as HttpStatus || HttpStatus.BAD_REQUEST;
      finalDetail = typeof statusOrDetail === 'string' ? statusOrDetail : undefined;
    } else if (typeof statusOrMessageOrErrors === 'string' && typeof messageOrStatus === 'string') {
      // (field: string, message: string, httpStatus: HttpStatus, detail?: string)
      errors = [{ field: statusOrMessageOrErrors, message: messageOrStatus }];
      httpStatus = statusOrDetail as HttpStatus;
      finalDetail = detail;
    } else if (typeof statusOrMessageOrErrors === 'string') {
      // (message: string, httpStatus: HttpStatus, detail?: string)
      errors = [{ message: statusOrMessageOrErrors }];
      httpStatus = messageOrStatus as HttpStatus;
      finalDetail = typeof statusOrDetail === 'string' ? statusOrDetail : undefined;
    } else {
      errors = [{ message: 'An error occurred' }];
      httpStatus = statusOrMessageOrErrors;
      finalDetail = undefined;
    }

    const response = finalDetail !== undefined ? { errors, detail: finalDetail } : { errors };
    super(response, httpStatus);
  }
}

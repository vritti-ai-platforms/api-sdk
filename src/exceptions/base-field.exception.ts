import { HttpException, HttpStatus } from '@nestjs/common';
import type { FieldError } from '../types/error-response.types';

// Re-export FieldError for backwards compatibility
export type { FieldError } from '../types/error-response.types';

export interface ProblemOptions {
  type?: string;
  label?: string;
  detail?: string;
  errors?: FieldError[];
}

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

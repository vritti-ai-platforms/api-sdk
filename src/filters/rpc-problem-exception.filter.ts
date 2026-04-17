import { type ArgumentsHost, Catch, type HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { type Observable, throwError } from 'rxjs';

interface FieldError {
  field: string;
  message: string;
}

interface ProblemPayload {
  type: string;
  label?: string;
  detail: string;
  message: string;
  errors: FieldError[];
  status: number;
  statusCode: number;
}

@Catch()
export class RpcProblemExceptionFilter {
  private readonly logger = new Logger(RpcProblemExceptionFilter.name);

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    if (this.isHttpException(exception)) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      return throwError(() => this.toProblemPayload(response, status));
    }

    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      return throwError(() =>
        this.toProblemPayload(
          {
            type: 'about:blank',
            detail: exception.message,
            errors: [],
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    }

    this.logger.error(`Unhandled non-error exception: ${JSON.stringify(exception)}`);
    return throwError(() =>
      this.toProblemPayload(
        {
          type: 'about:blank',
          detail: 'An unexpected error occurred',
          errors: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );
  }

  private toProblemPayload(response: unknown, status: number): ProblemPayload {
    if (typeof response === 'string') {
      return {
        type: 'about:blank',
        detail: response,
        message: response,
        errors: [],
        status,
        statusCode: status,
      };
    }

    const obj = (response ?? {}) as Record<string, unknown>;
    const detail = typeof obj.detail === 'string' ? obj.detail : 'Request failed';
    return {
      type: typeof obj.type === 'string' ? obj.type : 'about:blank',
      label: typeof obj.label === 'string' ? obj.label : undefined,
      detail,
      message: detail,
      errors: Array.isArray(obj.errors) ? (obj.errors as FieldError[]) : [],
      status,
      statusCode: status,
    };
  }

  private isHttpException(error: unknown): error is HttpException {
    return (
      error instanceof Error &&
      typeof (error as { getStatus?: unknown }).getStatus === 'function' &&
      typeof (error as { getResponse?: unknown }).getResponse === 'function'
    );
  }
}

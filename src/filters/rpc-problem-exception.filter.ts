import { type ArgumentsHost, Catch, type HttpException, HttpStatus, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { type Observable, throwError } from 'rxjs';
import { tryTranslatePgError } from './pg-error.translator';

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
    // Translate raw Postgres errors into a ConflictException before the rest of the filter handles them.
    const translatedPgError = tryTranslatePgError(exception);
    if (translatedPgError) exception = translatedPgError;

    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    if (this.isHttpException(exception)) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const payload = this.toProblemPayload(response, status);
      // Log 4xx/5xx so the microservice terminal shows what actually failed (previously silent)
      const log = status >= HttpStatus.INTERNAL_SERVER_ERROR ? this.logger.error : this.logger.warn;
      log.call(this.logger, `RPC ${status}: ${payload.detail}`);
      return throwError(() => payload);
    }

    if (exception instanceof Error) {
      const cause = (exception as { cause?: unknown }).cause;
      const causeMessage = cause instanceof Error ? cause.message : undefined;
      const causeStack = cause instanceof Error ? cause.stack : undefined;
      this.logger.error(causeMessage ?? exception.message, causeStack ?? exception.stack);
      if (cause && cause !== exception) {
        this.logger.error(`Wrapped by: ${exception.message}`);
      }
      return throwError(() =>
        this.toProblemPayload(
          {
            type: 'about:blank',
            detail: causeMessage ?? exception.message,
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
    // Prefer RFC 9457 `detail`, then Nest/@nestjs-common's `message` (string or class-validator array),
    // so exceptions thrown as `@nestjs/common` errors still surface their real message across NATS.
    const detail =
      typeof obj.detail === 'string'
        ? obj.detail
        : typeof obj.message === 'string'
          ? obj.message
          : Array.isArray(obj.message)
            ? obj.message.join(', ')
            : 'Request failed';
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

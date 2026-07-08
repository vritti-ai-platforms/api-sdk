import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  type HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse, FieldError } from '../types/error-response.types';
import { tryTranslatePgError } from './pg-error.translator';
import { extractProblemFromResponse, getHttpStatusTitle } from './problem-extraction';

export { getHttpStatusTitle };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // Translate raw Postgres errors (e.g. 23505 unique_violation) into a ConflictException before classifying as 500.
    const translatedPgError = tryTranslatePgError(exception);
    if (translatedPgError) exception = translatedPgError;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let type = 'about:blank';
    let label: string | undefined;
    let detail = 'Internal server error';
    let errors: FieldError[] = [];

    if (this.isHttpException(exception)) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Reuse the shared extractor so HTTP and GraphQL surface identical problem details.
      const extracted = extractProblemFromResponse(exceptionResponse, exception.message ?? getHttpStatusTitle(status));
      type = extracted.type;
      label = extracted.label;
      // Keep the initial 'Internal server error' when the body matched no known shape (byte-identical HTTP output).
      detail = extracted.detail ?? detail;
      errors = extracted.errors;
    } else if (this.isProblemLikeObject(exception)) {
      const problemObj = exception as Record<string, unknown>;
      const statusCandidate = problemObj.status ?? problemObj.statusCode;
      if (typeof statusCandidate === 'number' && statusCandidate >= 400 && statusCandidate <= 599) {
        status = statusCandidate;
      }
      type = typeof problemObj.type === 'string' ? problemObj.type : 'about:blank';
      label = typeof problemObj.label === 'string' ? problemObj.label : undefined;
      detail =
        typeof problemObj.detail === 'string'
          ? problemObj.detail
          : typeof problemObj.message === 'string'
            ? problemObj.message
            : getHttpStatusTitle(status);
      errors = Array.isArray(problemObj.errors) ? (problemObj.errors as FieldError[]) : [];
    } else if (this.isAxiosError(exception)) {
      // Outgoing HTTP call failures (e.g., service-to-service calls)
      const axiosStatus = exception.response?.status;
      const axiosDetail = exception.response?.data?.message || exception.response?.data?.detail || exception.message;
      const url = exception.config?.url;
      status = HttpStatus.BAD_GATEWAY;
      detail = `Upstream service error${axiosStatus ? ` (${axiosStatus})` : ''}: ${axiosDetail}`;
      this.logger.error(`Upstream API error [${axiosStatus}]: ${axiosDetail} — URL: ${url}`, exception.stack);
    } else {
      // Unknown errors — logged by HttpLoggerInterceptor, no need to log again here
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

    response.header('Content-Type', 'application/problem+json').status(status).send(problemDetails);
  }

  // Duck-type check for HttpException — avoids instanceof failing across pnpm package instances
  private isHttpException(error: unknown): error is HttpException {
    return (
      error instanceof Error &&
      typeof (error as { getStatus?: unknown }).getStatus === 'function' &&
      typeof (error as { getResponse?: unknown }).getResponse === 'function'
    );
  }

  // Duck-type check for AxiosError without importing axios
  private isAxiosError(error: unknown): error is Error & {
    isAxiosError: true;
    response?: { status?: number; data?: Record<string, unknown> };
    config?: { url?: string };
  } {
    return error instanceof Error && (error as { isAxiosError?: boolean }).isAxiosError === true;
  }

  private isProblemLikeObject(error: unknown): error is Record<string, unknown> {
    if (!error || typeof error !== 'object') return false;
    const obj = error as Record<string, unknown>;
    return (
      typeof obj.status === 'number' ||
      typeof obj.statusCode === 'number' ||
      typeof obj.detail === 'string' ||
      Array.isArray(obj.errors)
    );
  }
}

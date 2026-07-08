import { type ErrorCode, errorCodeFromStatus } from './error-code';
import { extractProblemFromResponse, getHttpStatusTitle } from './problem-extraction';

// graphql and @nestjs/graphql are optional peers not installed here, so we declare minimal structural shapes locally.

interface GraphqlFormattedErrorShape {
  message: string;
  locations?: ReadonlyArray<{ line: number; column: number }>;
  path?: ReadonlyArray<string | number>;
  extensions?: Record<string, unknown>;
}

interface GraphqlErrorShape {
  message: string;
  originalError?: unknown;
  extensions?: Record<string, unknown>;
}

interface HttpExceptionLike {
  getStatus(): number;
  getResponse(): string | object;
  message: string;
}

export interface GraphqlFormatErrorOptions {
  isProduction: boolean;
  getTraceId?: () => string | undefined;
}

export interface FormattedErrorExtensions {
  code: ErrorCode;
  traceId?: string;
  timestamp: string;
  fieldErrors?: Array<{ field: string; message: string }>;
  [key: string]: unknown;
}

// Duck-types a NestJS HttpException without importing @nestjs/common (cross-package-instance safe).
function isHttpExceptionLike(error: unknown): error is HttpExceptionLike {
  return (
    error instanceof Error &&
    typeof (error as { getStatus?: unknown }).getStatus === 'function' &&
    typeof (error as { getResponse?: unknown }).getResponse === 'function'
  );
}

interface ProblemLike {
  status?: number;
  statusCode?: number;
  detail?: string;
  message?: string;
}

function isProblemLike(error: unknown): error is ProblemLike {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  const o = error as Record<string, unknown>;
  return typeof o.status === 'number' || typeof o.statusCode === 'number';
}

interface ProblemSource {
  status: number;
  response: string | object;
  fallback: string;
}

// Walks the error chain to find the underlying HttpException or plain RFC 9457 problem via originalError/thrownValue.
function findProblemSource(error: GraphqlErrorShape | undefined): ProblemSource | undefined {
  let current: unknown = error;
  // Bounded walk — guard against cyclic chains.
  for (let depth = 0; current && depth < 10; depth++) {
    if (isHttpExceptionLike(current)) {
      const status = current.getStatus();
      return { status, response: current.getResponse(), fallback: current.message ?? getHttpStatusTitle(status) };
    }
    if (isProblemLike(current)) {
      const status = current.status ?? current.statusCode ?? 500;
      return { status, response: current, fallback: current.detail ?? current.message ?? getHttpStatusTitle(status) };
    }
    const next = current as { originalError?: unknown; thrownValue?: unknown };
    current = next.originalError ?? next.thrownValue;
  }
  return undefined;
}

const GENERIC_INTERNAL_MESSAGE = 'Internal server error';

// Builds an Apollo formatError that normalizes every GraphQL error into a stable, transport-consistent shape.
export function createGraphqlFormatError(
  opts: GraphqlFormatErrorOptions,
): (formattedError: GraphqlFormattedErrorShape, error: unknown) => GraphqlFormattedErrorShape {
  const { isProduction, getTraceId } = opts;

  return (formattedError, error) => {
    const gqlError = (error ?? undefined) as GraphqlErrorShape | undefined;
    const source = findProblemSource(gqlError);

    // Derive status + problem body from the underlying source since Apollo only copies .message and defaults code to INTERNAL.
    let status = 500;
    let detail: string | undefined;
    let label: string | undefined;
    let fieldErrors: Array<{ field: string; message: string }> = [];

    if (source) {
      status = source.status;
      const extracted = extractProblemFromResponse(source.response, source.fallback);
      detail = extracted.detail;
      label = extracted.label;
      fieldErrors = extracted.errors;
    }

    const code = errorCodeFromStatus(status);

    // Prefer the problem detail, then the formatted message; never surface internals for INTERNAL in production.
    let message = detail ?? formattedError.message;
    if (code === 'INTERNAL' && isProduction) {
      message = GENERIC_INTERNAL_MESSAGE;
    }

    // Start from Apollo's extensions so any framework-set keys survive, then normalize ours on top.
    const incoming: Record<string, unknown> = { ...(formattedError.extensions ?? {}) };

    const traceId = getTraceId?.();
    const timestamp = new Date().toISOString();

    const extensions: FormattedErrorExtensions = {
      ...incoming,
      // Always our canonical code — overrides Apollo's default INTERNAL_SERVER_ERROR.
      code,
      ...(traceId !== undefined ? { traceId } : {}),
      timestamp,
      ...(label !== undefined ? { label } : {}),
      ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
    };

    if (isProduction) {
      // Strip anything that could leak server internals to clients.
      delete extensions.stacktrace;
      delete extensions.exception;
      delete extensions.originalError;
    }

    const result: GraphqlFormattedErrorShape = {
      message,
      extensions,
    };
    // Preserve location/path metadata GraphQL attaches (useful to clients, leaks nothing).
    if (formattedError.locations) result.locations = formattedError.locations;
    if (formattedError.path) result.path = formattedError.path;

    return result;
  };
}

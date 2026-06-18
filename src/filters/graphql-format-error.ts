import { type ErrorCode, errorCodeFromStatus } from './error-code';
import { extractProblemFromResponse, getHttpStatusTitle } from './problem-extraction';

// ---------------------------------------------------------------------------
// Optional-peer typing
// ---------------------------------------------------------------------------
// `graphql` and `@nestjs/graphql` are optional peers — they are NOT installed in this package's
// own node_modules. A real `import type { GraphQLFormattedError } from 'graphql'` would therefore
// fail `tsc` ("cannot find module"). So, mirroring src/context/extractors/graphql.extractor.ts,
// we declare the minimal structural shapes locally. They are erased at compile time and add no
// runtime dependency; consumers (core-server) that DO have graphql installed pass the real objects.

// Minimal shape of graphql's GraphQLFormattedError (what Apollo's formatError receives/returns).
interface GraphqlFormattedErrorShape {
  message: string;
  locations?: ReadonlyArray<{ line: number; column: number }>;
  path?: ReadonlyArray<string | number>;
  extensions?: Record<string, unknown>;
}

// Minimal shape of graphql's GraphQLError (the 2nd `formatError` arg). For a NestJS HttpException
// thrown in a resolver, graphql wraps it and exposes the original under `originalError`.
interface GraphqlErrorShape {
  message: string;
  originalError?: unknown;
  extensions?: Record<string, unknown>;
}

// Structural shape of a NestJS HttpException — duck-typed (getStatus/getResponse), so we avoid
// importing @nestjs/common's HttpException across pnpm package boundaries (same approach the
// HttpExceptionFilter uses for its instanceof-free check).
interface HttpExceptionLike {
  getStatus(): number;
  getResponse(): string | object;
  message: string;
}

// ---------------------------------------------------------------------------
// Public options + emitted-extensions contract
// ---------------------------------------------------------------------------

export interface GraphqlFormatErrorOptions {
  // When true (production), strip stacktrace + internal originalError and genericize INTERNAL
  // messages so server internals never leak to clients.
  isProduction: boolean;
  // Ambient accessor for the current request's correlation/trace id. formatError has no request
  // argument, so the id must come from an out-of-band source (e.g. AsyncLocalStorage).
  getTraceId?: () => string | undefined;
}

// The shape of the `extensions` object this formatter guarantees on every formatted error.
export interface FormattedErrorExtensions {
  code: ErrorCode;
  traceId?: string;
  timestamp: string;
  // Field-specific validation errors, mirroring the RFC 9457 errors[] the HTTP filter emits.
  fieldErrors?: Array<{ field: string; message: string }>;
  // Passthrough for any other extension keys (e.g. stacktrace in dev).
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Duck-types a NestJS HttpException without importing @nestjs/common (cross-package-instance safe).
function isHttpExceptionLike(error: unknown): error is HttpExceptionLike {
  return (
    error instanceof Error &&
    typeof (error as { getStatus?: unknown }).getStatus === 'function' &&
    typeof (error as { getResponse?: unknown }).getResponse === 'function'
  );
}

// Walks the error chain (graphql wraps the thrown error under `originalError`) to find the
// underlying NestJS HttpException, if any.
function findHttpException(error: GraphqlErrorShape | undefined): HttpExceptionLike | undefined {
  let current: unknown = error;
  // Bounded walk — guard against cyclic originalError chains.
  for (let depth = 0; current && depth < 10; depth++) {
    if (isHttpExceptionLike(current)) {
      return current;
    }
    current = (current as { originalError?: unknown }).originalError;
  }
  return undefined;
}

const GENERIC_INTERNAL_MESSAGE = 'Internal server error';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// Builds an Apollo `formatError(formattedError, error)` that normalizes every GraphQL error into a
// stable, transport-consistent shape:
//   - extensions.code        canonical ErrorCode (derived from HTTP status; NOT Apollo's default)
//   - extensions.traceId     correlation id from opts.getTraceId() (omitted if unavailable)
//   - extensions.timestamp   ISO timestamp of formatting
//   - extensions.fieldErrors validation field errors mirroring the RFC 9457 errors[] (when present)
//   - message                human-readable; genericized for INTERNAL in production
// In production it also strips stacktrace and the internal originalError so nothing leaks.
export function createGraphqlFormatError(
  opts: GraphqlFormatErrorOptions,
): (formattedError: GraphqlFormattedErrorShape, error: unknown) => GraphqlFormattedErrorShape {
  const { isProduction, getTraceId } = opts;

  return (formattedError, error) => {
    const gqlError = (error ?? undefined) as GraphqlErrorShape | undefined;
    const httpException = findHttpException(gqlError);

    // Derive status + problem body from the underlying HttpException. Apollo only copies the
    // exception's .message into the formatted error and defaults extensions.code to
    // INTERNAL_SERVER_ERROR — it never reads getResponse() — so we read it ourselves here.
    let status = 500;
    let detail: string | undefined;
    let label: string | undefined;
    let fieldErrors: Array<{ field: string; message: string }> = [];

    if (httpException) {
      status = httpException.getStatus();
      const extracted = extractProblemFromResponse(
        httpException.getResponse(),
        httpException.message ?? getHttpStatusTitle(status),
      );
      detail = extracted.detail;
      label = extracted.label;
      fieldErrors = extracted.errors;
    }

    const code = errorCodeFromStatus(status);

    // Human-readable message: prefer the problem detail, then the formatted message. For INTERNAL
    // in production, never surface server internals.
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

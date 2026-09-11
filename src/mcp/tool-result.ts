import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '@nestjs/common';
import { ZodError } from 'zod';

export interface ToolFieldError {
  field?: string;
  message: string;
}

export interface ToolProblem {
  status: number;
  label?: string;
  detail: string;
  errors: ToolFieldError[];
}

interface HttpExceptionLike {
  getStatus(): number;
  getResponse(): unknown;
}

const PG_UNIQUE_VIOLATION = '23505';
const logger = new Logger('McpTool');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Duck-typed like the exception filter: pnpm may load more than one @nestjs/common, so instanceof is not reliable
function isHttpExceptionLike(value: unknown): value is HttpExceptionLike {
  return isRecord(value) && typeof value.getStatus === 'function' && typeof value.getResponse === 'function';
}

// Walks the cause chain for a Postgres unique violation the way the exception filter does
function findPgUniqueViolation(error: unknown, depth = 0): { detail?: string } | undefined {
  if (!isRecord(error) || depth > 5) return undefined;
  if (error.code === PG_UNIQUE_VIOLATION)
    return { detail: typeof error.detail === 'string' ? error.detail : undefined };
  return findPgUniqueViolation(error.cause, depth + 1);
}

function normalizeFieldErrors(value: unknown): ToolFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({
    field: typeof entry.field === 'string' ? entry.field : undefined,
    message: typeof entry.message === 'string' ? entry.message : 'Invalid value',
  }));
}

export function toolOk(payload: unknown): CallToolResult {
  const structuredContent = isRecord(payload) ? payload : { result: payload };
  return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent };
}

export function toolError(problem: ToolProblem): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(problem) }],
    structuredContent: { ...problem },
  };
}

// Turns whatever a handler threw into the problem shape the REST API speaks, so field errors reach the model verbatim
export function problemFromError(error: unknown): ToolProblem {
  if (error instanceof ZodError) {
    return {
      status: 400,
      label: 'Invalid Arguments',
      detail: 'The tool arguments did not match the schema.',
      errors: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    };
  }

  if (isHttpExceptionLike(error)) {
    const status = error.getStatus();
    const body = error.getResponse();
    if (isRecord(body)) {
      const detail =
        typeof body.detail === 'string'
          ? body.detail
          : typeof body.message === 'string'
            ? body.message
            : 'Request failed.';
      return {
        status,
        label: typeof body.label === 'string' ? body.label : undefined,
        detail,
        errors: normalizeFieldErrors(body.errors),
      };
    }
    return { status, detail: typeof body === 'string' ? body : 'Request failed.', errors: [] };
  }

  const duplicate = findPgUniqueViolation(error);
  if (duplicate) {
    return {
      status: 409,
      label: 'Duplicate Entry',
      detail: duplicate.detail ?? 'A record with these values already exists.',
      errors: [],
    };
  }

  logger.error(`Unhandled tool error: ${error instanceof Error ? error.stack : String(error)}`);
  return { status: 500, detail: 'An unexpected error occurred.', errors: [] };
}

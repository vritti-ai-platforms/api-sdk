import { ConflictException } from '../exceptions/conflict.exception';

const PG_UNIQUE_VIOLATION = '23505';

export type PgErrorShape = {
  code?: string;
  message?: string;
  constraint?: string;
  table?: string;
  schema?: string;
  column?: string;
  detail?: string;
  hint?: string;
};

// Returns a ConflictException for a Postgres unique-violation error, otherwise undefined.
export function tryTranslatePgError(error: unknown): ConflictException | undefined {
  const pgError = findPgError(error);
  if (!pgError) return undefined;
  const { code, constraint, table, detail } = pgError;
  if (code !== PG_UNIQUE_VIOLATION) return undefined;
  return new ConflictException({
    label: 'Duplicate Entry',
    detail: detail?.trim() || 'A record with these values already exists.',
    errors: [],
    ...(constraint || table ? { meta: { constraint, table } } : {}),
  });
}

// Walks up to N levels of `.cause` looking for a pg-shaped error (has SQLSTATE `code`), capping depth.
export function findPgError(error: unknown, depth = 0): PgErrorShape | undefined {
  if (!error || typeof error !== 'object' || depth > 5) return undefined;
  const candidate = error as PgErrorShape & { cause?: unknown };
  if (typeof candidate.code === 'string') return candidate;
  return findPgError(candidate.cause, depth + 1);
}

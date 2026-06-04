import { ConflictException } from '../exceptions/conflict.exception';

// Postgres SQLSTATE codes we translate before the global filters render the response.
// Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
//
// Today we only handle 23505 (unique_violation) — services already pre-check the common
// duplicate cases for friendly messages; this is the race-condition / unguarded-write backstop
// so a raw `error: duplicate key value violates unique constraint "..."` never reaches the
// client as a 500. Extend the switch below as we identify other SQLSTATEs worth surfacing
// (e.g. 23503 foreign_key_violation → 409 with FK info).
const PG_UNIQUE_VIOLATION = '23505';

type PgErrorShape = {
  code?: string;
  constraint?: string;
  table?: string;
  detail?: string;
};

// Returns a ConflictException for a Postgres unique-violation error, otherwise undefined.
// Both global filters call this at the top of their catch method so any 23505 escaping a
// service produces the same RFC 9457 payload regardless of where it was thrown.
//
// Drizzle 1.0+ wraps pg driver errors in `DrizzleQueryError` with the original pg error on
// `.cause`, so we walk a short cause chain to find the SQLSTATE.
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

// Walks up to N levels of `.cause` looking for a pg-shaped error (has SQLSTATE `code`).
// Caps depth so a circular `cause` graph can't trap us.
function findPgError(error: unknown, depth = 0): PgErrorShape | undefined {
  if (!error || typeof error !== 'object' || depth > 5) return undefined;
  const candidate = error as PgErrorShape & { cause?: unknown };
  if (typeof candidate.code === 'string') return candidate;
  return findPgError(candidate.cause, depth + 1);
}

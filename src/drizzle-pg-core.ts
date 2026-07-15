// Re-export all of drizzle-orm/pg-core
export * from 'drizzle-orm/pg-core';

import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check } from 'drizzle-orm/pg-core';
import { CODE_PATTERN_SOURCE, type CodeOptions, DOTTED_CODE_PATTERN_SOURCE } from './decorators/code-pattern';

// Builds a Postgres CHECK constraint enforcing the canonical code format on a column
export function codeCheck(name: string, column: AnyPgColumn, options?: CodeOptions) {
  const source = options?.dotted ? DOTTED_CODE_PATTERN_SOURCE : CODE_PATTERN_SOURCE;
  return check(name, sql`${column} ~ ${sql.raw(`'${source}'`)}`);
}

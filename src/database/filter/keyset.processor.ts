import { and, type Column, eq, gt, isNotNull, isNull, lt, or, type SQL, sql } from 'drizzle-orm';

export const MAX_PAGE_SIZE = 100;

export interface KeysetOrderBy {
  column: Column;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

// Stable signature of an ORDER BY, used to bind a cursor to the sort that produced it.
export function keysetSignature(entries: { key: string; direction: 'asc' | 'desc' }[]): string {
  return entries.map((e) => `${e.key}:${e.direction}`).join(',');
}

export class KeysetProcessor {
  // Builds the "after this row" predicate for keyset pagination.
  static buildAfter(orderBy: KeysetOrderBy[], values: unknown[]): SQL {
    const first = orderBy[0];
    if (!first) return sql`true`;
    // Fast path: uniform direction + all NOT NULL columns (>= 2 cols) → a Postgres row-value comparison.
    const uniform = orderBy.every((o) => o.direction === first.direction);
    const anyNullable = orderBy.some((o) => o.nulls !== undefined);
    if (uniform && !anyNullable && orderBy.length >= 2) {
      return KeysetProcessor.buildRowValue(orderBy, values, first.direction);
    }
    return KeysetProcessor.buildOrExpansion(orderBy, values);
  }

  // (c1, c2, …) > (v1, v2, …) for asc, < for desc. Correct only for uniform direction, no NULLs.
  private static buildRowValue(orderBy: KeysetOrderBy[], values: unknown[], direction: 'asc' | 'desc'): SQL {
    const cols = sql.join(
      orderBy.map((o) => sql`${o.column}`),
      sql`, `,
    );
    const vals = sql.join(
      values.map((v) => sql`${v}`),
      sql`, `,
    );
    const op = direction === 'asc' ? sql`>` : sql`<`;
    return sql`(${cols}) ${op} (${vals})`;
  }

  // Lexicographic OR-expansion, NULL-aware per column when a `nulls` placement is declared.
  private static buildOrExpansion(orderBy: KeysetOrderBy[], values: unknown[]): SQL {
    const groups: SQL[] = [];
    for (let i = 0; i < orderBy.length; i++) {
      const current = orderBy[i];
      if (!current) continue;
      const conditions: SQL[] = [];
      for (let j = 0; j < i; j++) {
        const prior = orderBy[j];
        if (prior) conditions.push(KeysetProcessor.tie(prior.column, values[j]));
      }
      conditions.push(KeysetProcessor.strictlyAfter(current, values[i]));
      const group = conditions.length === 1 ? conditions[0] : and(...conditions);
      if (group) groups.push(group);
    }
    const firstGroup = groups[0];
    if (groups.length === 1 && firstGroup) return firstGroup;
    return or(...groups) as SQL;
  }

  // Tie on an earlier column: match its boundary value (NULL-safe).
  private static tie(column: Column, value: unknown): SQL {
    return value === null || value === undefined ? isNull(column) : eq(column, value);
  }

  // Strictly past the boundary on this column, respecting direction and NULL placement.
  private static strictlyAfter(o: KeysetOrderBy, value: unknown): SQL {
    // NOT NULL column (no nulls hint): clean comparison — original behavior, index-friendly.
    if (o.nulls === undefined) {
      return (o.direction === 'asc' ? gt(o.column, value) : lt(o.column, value)) as SQL;
    }
    const nullsLast = o.nulls === 'last';
    // A NULL boundary value: only rows on the "far" side of the NULL group are strictly after it.
    if (value === null || value === undefined) {
      return (nullsLast ? sql`false` : isNotNull(o.column)) as SQL;
    }
    const cmp = o.direction === 'asc' ? gt(o.column, value) : lt(o.column, value);
    // With NULLS LAST, a NULL column value sorts after any non-NULL boundary → also "after".
    return (nullsLast ? or(cmp, isNull(o.column)) : cmp) as SQL;
  }
}

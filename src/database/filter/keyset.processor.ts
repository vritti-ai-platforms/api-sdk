import { and, type Column, eq, gt, lt, or, type SQL } from 'drizzle-orm';

export interface KeysetOrderBy {
  column: Column;
  direction: 'asc' | 'desc';
}

export class KeysetProcessor {
  // Builds the "after this row" predicate for keyset pagination via lexicographic OR-expansion.
  // Correct for multi-column AND mixed directions: OR over i of [ AND over j<i of eq(col_j, v_j) AND cmp(col_i, v_i) ].
  static buildAfter(orderBy: KeysetOrderBy[], values: unknown[]): SQL {
    const groups: SQL[] = [];
    for (let i = 0; i < orderBy.length; i++) {
      const current = orderBy[i];
      if (!current) continue;
      const conditions: SQL[] = [];
      // Tie on every earlier column
      for (let j = 0; j < i; j++) {
        const prior = orderBy[j];
        if (prior) conditions.push(eq(prior.column, values[j]));
      }
      // Then strictly past the boundary on the i-th column, respecting its direction
      const cmp = current.direction === 'asc' ? gt : lt;
      conditions.push(cmp(current.column, values[i]));
      const group = conditions.length === 1 ? conditions[0] : and(...conditions);
      if (group) groups.push(group);
    }
    const first = groups[0];
    if (groups.length === 1 && first) return first;
    return or(...groups) as SQL;
  }
}

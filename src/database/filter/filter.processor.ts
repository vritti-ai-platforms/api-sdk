import {
  and,
  asc,
  type Column,
  desc,
  eq,
  gt,
  gte,
  ilike,
  lt,
  lte,
  ne,
  notIlike,
  type SQL,
} from 'drizzle-orm';
import type { FilterCondition, SortCondition } from './filter.types';

export type FieldDefinition = { column: Column; type: 'string' | 'number' };
export type FieldMap = Record<string, FieldDefinition>;

export class FilterProcessor {
  // Returns undefined if no conditions (Drizzle accepts undefined as "no WHERE")
  static buildWhere(filters: FilterCondition[] = [], fieldMap: FieldMap): SQL | undefined {
    const conditions = filters.flatMap((f) => {
      const def = fieldMap[f.field];
      if (!def) return []; // unknown field — skip (security whitelist)
      const { column: col } = def;
      const val = f.value;
      switch (f.operator) {
        case 'equals':
          return [eq(col, val)];
        case 'notEquals':
          return [ne(col, val)];
        case 'contains':
          return [ilike(col, `%${val}%`)];
        case 'notContains':
          return [notIlike(col, `%${val}%`)];
        case 'gt':
          return [gt(col, val)];
        case 'gte':
          return [gte(col, val)];
        case 'lt':
          return [lt(col, val)];
        case 'lte':
          return [lte(col, val)];
        default:
          return [];
      }
    });
    return conditions.length ? and(...conditions) : undefined;
  }

  // Maps each SortCondition to an asc/desc SQL expression
  static buildOrderBy(sort: SortCondition[] = [], fieldMap: FieldMap): SQL[] {
    return sort.flatMap((s) => {
      const def = fieldMap[s.field];
      if (!def) return [];
      return [s.direction === 'asc' ? asc(def.column) : desc(def.column)];
    });
  }
}

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
  or,
  type SQL,
} from 'drizzle-orm';
import type { FilterCondition, SearchState, SortCondition } from './filter.types';

export type FieldDefinition =
  | { column: Column; type: 'string' | 'number' | 'boolean' }
  | { expression: (value: string | number) => SQL; type: 'string' | 'number' | 'boolean' };
export type FieldMap = Record<string, FieldDefinition>;

export class FilterProcessor {
  // Returns undefined if no conditions (Drizzle accepts undefined as "no WHERE")
  static buildWhere(filters: FilterCondition[] = [], fieldMap: FieldMap): SQL | undefined {
    const conditions = filters.flatMap((f) => {
      const def = fieldMap[f.field];
      if (!def) return []; // unknown field — skip (security whitelist)
      // Expression field — delegate SQL generation to the caller-supplied factory
      if ('expression' in def) return [def.expression(f.value)];
      const { column: col } = def;
      const val = f.value;
      switch (f.operator) {
        case 'equals':
          if (def.type === 'boolean') return [eq(col, val === 'true' || val === 1)];
          return [eq(col, val)];
        case 'notEquals':
          if (def.type === 'boolean') return [ne(col, val === 'true' || val === 1)];
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

  // Builds a search WHERE — OR across all string fields when columnId is 'all', otherwise a single ilike
  static buildSearch(search: SearchState | null | undefined, fieldMap: FieldMap): SQL | undefined {
    if (!search?.value) return undefined;

    if (search.columnId === 'all') {
      const conditions = Object.values(fieldMap)
        .filter((def): def is { column: Column; type: 'string' | 'number' | 'boolean' } => 'column' in def && def.type === 'string')
        .map((def) => ilike(def.column, `%${search.value}%`));
      return conditions.length ? or(...conditions) : undefined;
    }

    const def = fieldMap[search.columnId];
    if (!def || !('column' in def)) return undefined;
    return ilike(def.column, `%${search.value}%`);
  }

  // Maps each SortCondition to an asc/desc SQL expression
  static buildOrderBy(sort: SortCondition[] = [], fieldMap: FieldMap): SQL[] {
    return sort.flatMap((s) => {
      const def = fieldMap[s.field];
      if (!def || !('column' in def)) return [];
      return [s.direction === 'asc' ? asc(def.column) : desc(def.column)];
    });
  }
}

import {
  and,
  asc,
  type Column,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  notIlike,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm';
import type { FilterCondition, FilterOperator, SearchState, SortCondition } from './filter.types';

export type FieldDefinition =
  // `nulls` declares NULL sort placement for a nullable column when used as a keyset sort key; omit for
  // NOT NULL columns (the common case).
  | { column: Column; type: 'string' | 'number' | 'boolean'; nulls?: 'first' | 'last' }
  | { expression: (value: string | number, operator: FilterOperator) => SQL; type: 'string' | 'number' | 'boolean' };
export type FieldMap = Record<string, FieldDefinition>;

export class FilterProcessor {
  // Returns undefined if no conditions (Drizzle accepts undefined as "no WHERE")
  static buildWhere(filters: FilterCondition[] = [], fieldMap: FieldMap): SQL | undefined {
    const conditions = filters.flatMap((f) => {
      const def = fieldMap[f.field];
      if (!def) return []; // unknown field — skip (security whitelist)
      // Expression field — delegate SQL generation to the caller-supplied factory (operator passed for custom handling)
      if ('expression' in def) return Array.isArray(f.value) ? [] : [def.expression(f.value, f.operator)];
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
        case 'isAnyOf':
          return [inArray(col, Array.isArray(val) ? val : [String(val)])];
        case 'isNotAnyOf':
          return [notInArray(col, Array.isArray(val) ? val : [String(val)])];
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
        .filter(
          (def): def is { column: Column; type: 'string' | 'number' | 'boolean' } =>
            'column' in def && def.type === 'string',
        )
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

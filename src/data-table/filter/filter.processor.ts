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
  sql,
} from 'drizzle-orm';
import type { FilterCondition, FilterOperator, SearchState, SortCondition } from './filter.types';

type FieldType = 'string' | 'number' | 'boolean';

export type Uuid = string & { readonly __brand: 'Uuid' };
export type MultiValueOperator = 'isAnyOf' | 'isNotAnyOf';
export type ValueFormat = 'uuid' | 'string';
type Formatted<F extends ValueFormat> = F extends 'uuid' ? Uuid : string;

export type WildcardFieldDefinition = {
  [K in ValueFormat]: {
    [V in ValueFormat]: {
      wildcardExpression: (args: { key: Formatted<K>; values: Formatted<V>[]; operator: MultiValueOperator }) => SQL;
      keyFormat: K;
      valueFormat: V;
      type: FieldType;
    };
  }[ValueFormat];
}[ValueFormat];

export type FieldDefinition =
  | { column: Column; type: FieldType; nulls?: 'first' | 'last' }
  | { expression: (value: string | number, operator: FilterOperator) => SQL; type: FieldType }
  | { multiExpression: (values: string[], operator: MultiValueOperator) => SQL; type: FieldType }
  | WildcardFieldDefinition;
export type FieldMap = Record<string, FieldDefinition>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WILDCARD_SUFFIX = '*';

// True for a canonical uuid string, narrowing it to Uuid
export function isUuid(value: string): value is Uuid {
  return UUID_PATTERN.test(value);
}

export class FilterProcessor {
  // Returns undefined if no conditions (Drizzle accepts undefined as "no WHERE")
  static buildWhere(filters: FilterCondition[] = [], fieldMap: FieldMap): SQL | undefined {
    const conditions = filters.flatMap((f) => {
      // Saved table state is client-supplied, so a condition can arrive without a usable field — skip it as unknown
      if (typeof f.field !== 'string' || f.field === '') return [];

      const def = fieldMap[f.field];
      if (!def) {
        const wildcard = FilterProcessor.resolveWildcard(f.field, fieldMap);
        return wildcard ? FilterProcessor.buildWildcard(wildcard.def, wildcard.key, f) : [];
      }
      // A wildcard definition only answers through its 'prefix*' key — named exactly, it is a misconfiguration
      if ('wildcardExpression' in def) return [];

      // Multi-value expression — always handed an array, so a multi-select filter keeps every value it picked
      if ('multiExpression' in def) {
        const operator = FilterProcessor.multiValueOperator(f.operator);
        const values = FilterProcessor.valuesOf(f.value);
        return operator && values.length ? [def.multiExpression(values, operator)] : [];
      }
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

  // The longest 'prefix*' wildcard entry matching the field, with the part after the prefix as its key
  // (e.g. 'dimension:*' serves 'dimension:<id>'; keep '.' out of filter names, which form libraries read as paths)
  private static resolveWildcard(
    field: string,
    fieldMap: FieldMap,
  ): { def: WildcardFieldDefinition; key: string } | undefined {
    let match: { def: WildcardFieldDefinition; key: string; prefixLength: number } | undefined;
    for (const [name, def] of Object.entries(fieldMap)) {
      if (!name.endsWith(WILDCARD_SUFFIX) || !('wildcardExpression' in def)) continue;
      const prefix = name.slice(0, -1);
      const key = field.slice(prefix.length);
      if (!field.startsWith(prefix) || key === '') continue;
      if (!match || prefix.length > match.prefixLength) match = { def, key, prefixLength: prefix.length };
    }
    return match && { def: match.def, key: match.key };
  }

  // Applies a wildcard entry's formats before its expression sees anything: a key or value that is not what the entry
  // declared is dropped here, so the expression's Uuid types are true by the time it runs
  private static buildWildcard(def: WildcardFieldDefinition, key: string, f: FilterCondition): SQL[] {
    const operator = FilterProcessor.multiValueOperator(f.operator);
    if (!operator) return [];
    if (def.keyFormat === 'uuid' && !isUuid(key)) return [];

    const values = FilterProcessor.valuesOf(f.value);
    const kept = def.valueFormat === 'uuid' ? values.filter(isUuid) : values;
    if (kept.length === 0) return [];

    // The formats were just enforced, so the narrowed shapes are the ones the definition declared
    return [
      (def.wildcardExpression as (args: { key: string; values: string[]; operator: MultiValueOperator }) => SQL)({
        key,
        values: kept,
        operator,
      }),
    ];
  }

  // A multi-select sends isAnyOf / isNotAnyOf; a single pick of the same filter reads as equals / notEquals
  private static multiValueOperator(operator: FilterOperator): MultiValueOperator | undefined {
    if (operator === 'isAnyOf' || operator === 'equals') return 'isAnyOf';
    if (operator === 'isNotAnyOf' || operator === 'notEquals') return 'isNotAnyOf';
    return undefined;
  }

  // A condition's value as a list of strings, whether it arrived as one value or many
  private static valuesOf(value: FilterCondition['value']): string[] {
    return (Array.isArray(value) ? value : [value]).map(String).filter((entry) => entry !== '');
  }

  // Builds a search WHERE — OR across all string fields when columnId is 'all', otherwise a single ilike
  // Field maps expose uuid columns as 'string' so the multi-select filters (isAnyOf → inArray) work, but Postgres has
  // no ILIKE for uuid: an "all columns" search must skip them, and a search aimed at one can only be an exact match.
  static buildSearch(search: SearchState | null | undefined, fieldMap: FieldMap): SQL | undefined {
    if (!search?.value) return undefined;

    if (search.columnId === 'all') {
      const conditions = Object.values(fieldMap)
        .filter(
          (def): def is { column: Column; type: 'string' | 'number' | 'boolean' } =>
            'column' in def && def.type === 'string' && !FilterProcessor.isUuidColumn(def.column),
        )
        .map((def) => ilike(def.column, `%${search.value}%`));
      return conditions.length ? or(...conditions) : undefined;
    }

    const def = fieldMap[search.columnId];
    if (!def || !('column' in def)) return undefined;
    if (FilterProcessor.isUuidColumn(def.column)) {
      // Anything that is not a full uuid cannot match a uuid column — say so with an empty result, not with a 500
      return isUuid(search.value) ? eq(def.column, search.value) : sql`false`;
    }
    return ilike(def.column, `%${search.value}%`);
  }

  private static isUuidColumn(column: Column): boolean {
    return column.columnType === 'PgUUID';
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

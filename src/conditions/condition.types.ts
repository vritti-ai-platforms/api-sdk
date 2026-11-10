export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isAnyOf'
  | 'isNotAnyOf'
  | 'between';

export const FilterOperators = {
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  IS_ANY_OF: 'isAnyOf',
  IS_NOT_ANY_OF: 'isNotAnyOf',
  BETWEEN: 'between',
} as const satisfies Record<string, FilterOperator>;

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | number | string[];
}

export interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchState {
  columnId: string;
  value: string;
}

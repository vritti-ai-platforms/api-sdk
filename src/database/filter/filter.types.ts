export type FilterOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'gt' | 'gte' | 'lt' | 'lte' | 'isAnyOf' | 'isNotAnyOf';

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

export type DensityType = 'compact' | 'normal' | 'comfortable';

export interface ColumnPinning {
  left: string[];
  right: string[];
}

export interface SearchState {
  columnId: string;
  value: string;
}

export interface TableViewState {
  filters: FilterCondition[];
  sort: SortCondition[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  columnPinning: ColumnPinning;
  lockedColumnSizing: boolean;
  density: DensityType;
  filterOrder: string[];
  filterVisibility: Record<string, boolean>;
  search: SearchState | null;
  pagination: { limit: number; offset: number };
}

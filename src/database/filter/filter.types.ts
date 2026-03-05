export type FilterOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'gt' | 'gte' | 'lt' | 'lte';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string | number;
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
}

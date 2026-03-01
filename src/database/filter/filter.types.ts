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

export interface TableViewState {
  filters: FilterCondition[];
  sort: SortCondition[];
  columnVisibility: Record<string, boolean>;
}

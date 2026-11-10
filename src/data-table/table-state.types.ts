import type { FilterCondition, SearchState, SortCondition } from '@vritti/api-sdk/conditions';

export type DensityType = 'compact' | 'normal' | 'comfortable';

export interface ColumnPinning {
  left: string[];
  right: string[];
}

export interface TableFilters {
  panel: FilterCondition[];
  context: FilterCondition[];
}

export interface TableState {
  filters: TableFilters;
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

// What a table page query reads: a saved TableState is one, and so is a page request another service sends
export type TablePageRequest = Pick<TableState, 'filters' | 'search' | 'sort' | 'pagination'>;

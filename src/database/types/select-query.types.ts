import type { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

export interface SelectQueryOption {
  value: string | number | boolean;
  label: string;
  description?: string;
  additionals?: Record<string, string | number | boolean | null>;
  groupId?: string | number;
}

export interface SelectQueryGroup {
  id: string | number;
  name: string;
}

export interface SelectQueryResult {
  options: SelectQueryOption[];
  groups?: SelectQueryGroup[];
  hasMore: boolean;
  totalCount?: number;
}

export interface FindForSelectJoin {
  table: PgTable;
  on: SQL;
  type?: 'left' | 'inner';
}

export interface FindForSelectConfig {
  value: string;
  label: string;
  description?: string;
  additionalKeys?: string | string[];
  groupIdKey?: string;
  search?: string;
  limit?: number;
  offset?: number;
  where?: Record<string, unknown>;
  orderByKey?: string;
  orderDirection?: 'asc' | 'desc';
  orderBy?: Record<string, 'asc' | 'desc'>;
  groups?: SelectQueryGroup[];
  values?: string | (string | number | boolean)[];
  excludeIds?: string | (string | number | boolean)[];
  groupTable?: PgTable;
  groupLabelKey?: string;
  groupTableIdKey?: string;
  // Optional JOINs on the base table
  joins?: FindForSelectJoin[];
  // Additional raw SQL conditions (for joined table columns)
  conditions?: SQL[];
  // Use SELECT DISTINCT instead of SELECT (for deduplication across versions)
  distinct?: boolean;
}

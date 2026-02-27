import type { PgTable } from 'drizzle-orm/pg-core';

export interface SelectQueryOption {
  value: string | number | boolean;
  label: string;
  description?: string;
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

export interface FindForSelectConfig {
  value: string;
  label: string;
  description?: string;
  groupId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  groups?: SelectQueryGroup[];
  values?: string | (string | number | boolean)[];
  excludeIds?: string | (string | number | boolean)[];
  groupTable?: PgTable;
  groupLabelKey?: string;
  groupIdKey?: string;
}

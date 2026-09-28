import type { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

export type SelectAdditionalValue = string | number | boolean | null | object;

export interface SelectQueryOption {
  value: string | number | boolean;
  label: string;
  description?: string;
  // A json/jsonb expression arrives already parsed, so an additional may be an object or array — it is passed
  // through rather than stringified, which would make it unusable
  additionals?: Record<string, SelectAdditionalValue>;
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
  additionalExpressions?: Record<string, SQL>;
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
  joins?: FindForSelectJoin[];
  conditions?: SQL[];
  distinct?: boolean;
}

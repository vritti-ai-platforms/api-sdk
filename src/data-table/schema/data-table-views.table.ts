import type { TableViewState } from '../../database/filter/filter.types';
import { boolean, index, jsonb, timestamp, uniqueIndex, uuid, varchar } from '../../drizzle-pg-core';

// Returns a fresh set of column builder instances — call once per table declaration
export function dataTableViewsColumns() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    tableSlug: varchar('table_slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    state: jsonb('state').notNull().$type<TableViewState>(),
    isShared: boolean('is_shared').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
  };
}

// Index definitions — reusable callback, works with any table that has the same column names
// biome-ignore lint/suspicious/noExplicitAny: receives Drizzle-bound columns, not raw builders
export function dataTableViewsIndexes(table: any) {
  return [
    index('table_views_user_table_idx').on(table.userId, table.tableSlug),
    index('table_views_shared_slug_idx').on(table.tableSlug, table.isShared),
    uniqueIndex('table_views_user_table_name_shared_unique').on(
      table.userId,
      table.tableSlug,
      table.name,
      table.isShared,
    ),
  ];
}

// Shape of a persisted table view record — used across service, repository, and DTO layers
export interface DataTableViewRecord {
  id: string;
  userId: string;
  tableSlug: string;
  name: string;
  state: TableViewState;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date | null | undefined;
}

// Shape of a new table view record for insertion — server-generated fields omitted
export interface NewDataTableViewRecord {
  userId: string;
  tableSlug: string;
  name: string;
  state: TableViewState;
  isShared?: boolean;
}

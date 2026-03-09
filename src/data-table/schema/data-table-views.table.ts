import type { TableViewState } from '../../database/filter/filter.types';
import { boolean, index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from '../../drizzle-pg-core';

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

// Named view snapshots — live state is stored in Redis only, not here
export const dataTableViews = pgTable('table_views', dataTableViewsColumns(), dataTableViewsIndexes);

export type DataTableView = typeof dataTableViews.$inferSelect;
export type NewDataTableView = typeof dataTableViews.$inferInsert;

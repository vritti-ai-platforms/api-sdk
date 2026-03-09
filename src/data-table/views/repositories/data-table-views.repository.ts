import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { PrimaryBaseRepository } from '../../../database/repositories/primary-base.repository';
import { PrimaryDatabaseService } from '../../../database/services/primary-database.service';
import { DATA_TABLE_VIEWS_TABLE } from '../../data-table.constants';
import type { DataTableViewRecord, NewDataTableViewRecord } from '../../schema/data-table-views.table';

const NAMED_VIEWS_LIMIT = 100;

@Injectable()
export class DataTableViewsRepository extends PrimaryBaseRepository<PgTable, NewDataTableViewRecord, DataTableViewRecord> {
  constructor(
    database: PrimaryDatabaseService,
    @Inject(DATA_TABLE_VIEWS_TABLE) table: PgTable,
  ) {
    super(database, table);
  }

  // Returns personal (non-shared) named views owned by the user for a given table
  async findPersonalViewsBySlug(userId: string, tableSlug: string): Promise<DataTableViewRecord[]> {
    // biome-ignore lint/suspicious/noExplicitAny: table columns are typed at runtime via the injected schema-qualified table
    const t = this.table as any;
    return this.db
      .select()
      .from(this.table)
      .where(and(eq(t.tableSlug, tableSlug), eq(t.userId, userId), eq(t.isShared, false)))
      .orderBy(t.createdAt)
      .limit(NAMED_VIEWS_LIMIT) as unknown as Promise<DataTableViewRecord[]>;
  }

  // Returns all shared named views for a given table — visible to all users
  async findSharedViewsBySlug(tableSlug: string): Promise<DataTableViewRecord[]> {
    // biome-ignore lint/suspicious/noExplicitAny: table columns are typed at runtime via the injected schema-qualified table
    const t = this.table as any;
    return this.db
      .select()
      .from(this.table)
      .where(and(eq(t.tableSlug, tableSlug), eq(t.isShared, true)))
      .orderBy(t.createdAt)
      .limit(NAMED_VIEWS_LIMIT) as unknown as Promise<DataTableViewRecord[]>;
  }
}

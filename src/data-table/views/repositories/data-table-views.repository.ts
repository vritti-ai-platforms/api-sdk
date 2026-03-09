import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PrimaryBaseRepository } from '../../../database/repositories/primary-base.repository';
import { PrimaryDatabaseService } from '../../../database/services/primary-database.service';
import { type DataTableView, dataTableViews } from '../../schema/data-table-views.table';

const NAMED_VIEWS_LIMIT = 100;

@Injectable()
export class DataTableViewsRepository extends PrimaryBaseRepository<typeof dataTableViews> {
  constructor(database: PrimaryDatabaseService) {
    super(database, dataTableViews);
  }

  // Returns personal (non-shared) named views owned by the user for a given table
  async findPersonalViewsBySlug(userId: string, tableSlug: string): Promise<DataTableView[]> {
    return this.db
      .select()
      .from(dataTableViews)
      .where(and(eq(dataTableViews.tableSlug, tableSlug), eq(dataTableViews.userId, userId), eq(dataTableViews.isShared, false)))
      .orderBy(dataTableViews.createdAt)
      .limit(NAMED_VIEWS_LIMIT);
  }

  // Returns all shared named views for a given table — visible to all users
  async findSharedViewsBySlug(tableSlug: string): Promise<DataTableView[]> {
    return this.db
      .select()
      .from(dataTableViews)
      .where(and(eq(dataTableViews.tableSlug, tableSlug), eq(dataTableViews.isShared, true)))
      .orderBy(dataTableViews.createdAt)
      .limit(NAMED_VIEWS_LIMIT);
  }
}

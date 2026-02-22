import { Logger } from '@nestjs/common';
import {
  and,
  asc,
  type Column,
  eq,
  getTableName,
  type InferInsertModel,
  type InferSelectModel,
  ilike,
  inArray,
  notInArray,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { TypedDrizzleClient } from '../schema.registry';
import { PrimaryDatabaseService } from '../services/primary-database.service';
import type { FindForSelectConfig, SelectQueryResult } from '../types';

// Converts snake_case string to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

type RelationsWhereFilter = Record<string, unknown>;

interface TypedRelationalQueryBuilder<TSelect> {
  findFirst(config?: {
    where?: RelationsWhereFilter;
    with?: Record<string, unknown>;
    columns?: Record<string, boolean>;
  }): Promise<TSelect | undefined>;

  findMany(config?: {
    where?: RelationsWhereFilter;
    orderBy?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    offset?: number;
    with?: Record<string, unknown>;
    columns?: Record<string, boolean>;
  }): Promise<TSelect[]>;
}

export abstract class PrimaryBaseRepository<
  TTable extends PgTable,
  TInsert = InferInsertModel<TTable>,
  TSelect = InferSelectModel<TTable>,
> {
  protected readonly logger: Logger;

  private readonly tableName: string;

  protected get db(): TypedDrizzleClient {
    return this.database.drizzleClient;
  }

  protected get model(): TypedRelationalQueryBuilder<TSelect> {
    const query = this.database.drizzleClient.query;
    const queryKeys = Object.keys(query || {});
    this.logger.debug(`Looking for '${this.tableName}' in query keys: [${queryKeys.join(', ')}]`);

    const model = query[this.tableName as keyof TypedDrizzleClient['query']];
    if (!model) {
      this.logger.error(`Table '${this.tableName}' not found in query object. Available: [${queryKeys.join(', ')}]`);
    }

    return model as unknown as TypedRelationalQueryBuilder<TSelect>;
  }

  constructor(
    protected readonly database: PrimaryDatabaseService,
    protected readonly table: TTable,
  ) {
    // Convert snake_case table name to camelCase to match Drizzle query object keys
    // Example: 'email_verifications' -> 'emailVerifications'
    const dbTableName = getTableName(table);
    this.tableName = snakeToCamel(dbTableName);
    this.logger = new Logger(this.constructor.name);
    this.logger.debug(`Initialized ${this.constructor.name}`);
    this.logger.debug(`Table name: '${dbTableName}' -> query key: '${this.tableName}'`);
  }

  // Creates a new record and returns it
  async create(data: TInsert): Promise<TSelect> {
    this.logger.log('Creating record');
    const results = (await this.db
      .insert(this.table as PgTable)
      .values(data as Record<string, unknown>)
      .returning()) as TSelect[];
    const record = results[0];
    if (!record) throw new Error(`${this.tableName}: database operation returned no record`);
    return record;
  }

  // Finds a single record by primary key ID
  async findById(id: string): Promise<TSelect | undefined> {
    this.logger.debug(`Finding record by ID: ${id}`);
    return this.model.findFirst({
      where: { id },
    });
  }

  // Finds a single record matching the given where filter
  async findOne(where: RelationsWhereFilter): Promise<TSelect | undefined> {
    this.logger.debug('Finding record with custom query');
    return this.model.findFirst({ where });
  }

  // Finds multiple records with optional filtering, ordering, and pagination
  async findMany(options?: {
    where?: RelationsWhereFilter;
    orderBy?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    offset?: number;
  }): Promise<TSelect[]> {
    this.logger.debug('Finding multiple records');
    return this.model.findMany(options);
  }

  // Updates a record by ID and returns the updated record
  async update(id: string, data: Partial<TInsert>): Promise<TSelect> {
    this.logger.log(`Updating record with ID: ${id}`);
    const idColumn = (this.table as unknown as Record<string, Column>).id;
    if (!idColumn) throw new Error(`Table '${this.tableName}' has no 'id' column`);
    const results = (await this.db
      .update(this.table as PgTable)
      .set(data as Record<string, unknown>)
      .where(eq(idColumn, id))
      .returning()) as TSelect[];
    const record = results[0];
    if (!record) throw new Error(`${this.tableName}: database operation returned no record`);
    return record;
  }

  // Updates all records matching the SQL condition and returns the affected count
  async updateMany(where: SQL, data: Partial<TInsert>): Promise<{ count: number }> {
    this.logger.log('Updating multiple records');
    const result = await this.db
      .update(this.table as PgTable)
      .set(data as Record<string, unknown>)
      .where(where);
    return { count: result.rowCount ?? 0 };
  }

  // Deletes a record by ID and returns the deleted record
  async delete(id: string): Promise<TSelect> {
    this.logger.log(`Deleting record with ID: ${id}`);
    const idColumn = (this.table as unknown as Record<string, Column>).id;
    if (!idColumn) throw new Error(`Table '${this.tableName}' has no 'id' column`);
    const results = (await this.db
      .delete(this.table as PgTable)
      .where(eq(idColumn, id))
      .returning()) as TSelect[];
    const record = results[0];
    if (!record) throw new Error(`${this.tableName}: database operation returned no record`);
    return record;
  }

  // Deletes all records matching the SQL condition and returns the affected count
  async deleteMany(where: SQL): Promise<{ count: number }> {
    this.logger.log('Deleting multiple records');
    const result = await this.db.delete(this.table as PgTable).where(where);
    return { count: result.rowCount ?? 0 };
  }

  // Counts records matching the optional SQL condition
  async count(where?: SQL): Promise<number> {
    this.logger.debug('Counting records');

    let query = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table as PgTable)
      .$dynamic();

    if (where) {
      query = query.where(where);
    }

    const results = await query;
    return (results[0] as { count: number }).count;
  }

  // Returns true if at least one record matches the SQL condition
  async exists(where: SQL): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  // Finds records formatted as select dropdown options with optional search, pagination, and grouping
  async findForSelect(config: FindForSelectConfig): Promise<SelectQueryResult> {
    this.logger.debug('Finding records for select dropdown');

    interface SelectRow {
      value: string | number | boolean;
      label: string;
      groupId?: string | number;
    }
    interface SelectRowWithCount extends SelectRow {
      totalCount: number;
    }

    // Parse values from CSV string or use array as-is
    const parsedValues =
      typeof config.values === 'string'
        ? config.values
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : config.values;

    // Parse excludeIds from CSV string or use array as-is
    const parsedExcludeIds =
      typeof config.excludeIds === 'string'
        ? config.excludeIds
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : (config.excludeIds ?? []);

    const tableColumns = this.table as unknown as Record<string, Column>;
    const valueCol = tableColumns[config.value];
    if (!valueCol) throw new Error(`Column '${config.value}' not found in table '${this.tableName}'`);
    const labelCol = tableColumns[config.label];
    if (!labelCol) throw new Error(`Column '${config.label}' not found in table '${this.tableName}'`);

    // When values are provided, fetch those specific options by value (skip search/pagination)
    if (parsedValues && parsedValues.length > 0) {
      const selectCols: Record<string, Column | SQL> = { value: valueCol, label: labelCol };
      if (config.groupId) {
        const groupIdCol = tableColumns[config.groupId];
        if (groupIdCol) selectCols.groupId = groupIdCol;
      }

      const rows = await this.db
        .select(selectCols)
        .from(this.table as PgTable)
        .where(inArray(valueCol, parsedValues));

      return {
        options: (rows as unknown as SelectRow[]).map((row) => ({
          value: row.value,
          label: String(row.label),
          ...(config.groupId && row.groupId != null ? { groupId: row.groupId } : {}),
        })),
        hasMore: false,
        ...(config.groups ? { groups: config.groups } : {}),
      };
    }

    // Use SQL builder for count(*) over() window function support
    const selectFields: Record<string, Column | SQL> = {
      value: valueCol,
      label: labelCol,
      totalCount: sql<number>`count(*) over()`.mapWith(Number),
    };
    if (config.groupId) {
      const groupIdCol = tableColumns[config.groupId];
      if (groupIdCol) selectFields.groupId = groupIdCol;
    }

    const conditions: SQL[] = [];
    if (config.search) {
      conditions.push(ilike(labelCol, `%${config.search}%`));
    }
    if (parsedExcludeIds.length > 0) {
      conditions.push(notInArray(valueCol, parsedExcludeIds));
    }
    if (config.where) {
      for (const [field, val] of Object.entries(config.where)) {
        const column = tableColumns[field];
        if (column) {
          conditions.push(eq(column, val));
        }
      }
    }

    const orderByKey = config.orderBy ? Object.keys(config.orderBy)[0] : undefined;
    const orderByCol = orderByKey ? (tableColumns[orderByKey] ?? labelCol) : labelCol;
    const limit = Number(config.limit) || 20;
    const offset = Number(config.offset) || 0;

    let query = this.db
      .select(selectFields)
      .from(this.table as PgTable)
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions) as SQL);
    }

    const orderClauses: SQL[] = [];
    if (config.groupId) {
      const groupIdCol = tableColumns[config.groupId];
      if (groupIdCol) orderClauses.push(asc(groupIdCol));
    }
    orderClauses.push(asc(orderByCol));

    query = query
      .orderBy(...orderClauses)
      .limit(limit)
      .offset(offset);

    const rows = await query;

    const totalCount = rows.length > 0 ? (rows[0] as unknown as SelectRowWithCount).totalCount : 0;

    const options = (rows as unknown as SelectRow[]).map((row) => ({
      value: row.value,
      label: String(row.label),
      ...(config.groupId && row.groupId != null ? { groupId: row.groupId } : {}),
    }));

    // Auto-resolve groups from groupTable when provided
    let resolvedGroups = config.groups;

    if (config.groupTable && config.groupId) {
      const groupTableColumns = config.groupTable as unknown as Record<string, Column>;
      const groupIdKey = config.groupIdKey ?? 'id';
      const groupNameKey = config.groupLabelKey ?? 'name';
      const groupIdCol = groupTableColumns[groupIdKey];
      if (!groupIdCol) throw new Error(`Column '${groupIdKey}' not found in group table`);
      const groupNameCol = groupTableColumns[groupNameKey];
      if (!groupNameCol) throw new Error(`Column '${groupNameKey}' not found in group table`);

      const groupRows = await this.db
        .select({ id: groupIdCol, name: groupNameCol })
        .from(config.groupTable)
        .orderBy(asc(groupNameCol));

      resolvedGroups = (groupRows as unknown as Array<{ id: string | number; name: string }>).map((r) => ({
        id: r.id,
        name: String(r.name),
      }));
    }

    return {
      options,
      hasMore: offset + limit < totalCount,
      totalCount,
      ...(resolvedGroups ? { groups: resolvedGroups } : {}),
    };
  }
}

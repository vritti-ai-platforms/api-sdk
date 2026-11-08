import { Logger } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  getTableName,
  getViewName,
  type InferInsertModel,
  type InferSelectModel,
  type InferSelectViewModel,
  ilike,
  inArray,
  is,
  notInArray,
  or,
  type SQL,
  type Subquery,
  sql,
} from 'drizzle-orm';
import type { PgColumn, PgSequence, PgTable, SelectedFields } from 'drizzle-orm/pg-core';
import type { AnyPgAsyncSelect } from 'drizzle-orm/pg-core/async';
import { PgViewBase } from 'drizzle-orm/pg-core/view-base';
import type { FindForSelectConfig, SelectAdditionalValue, SelectQueryResult } from '../../select';
import type { TypedDrizzleClient } from '../schema.registry';
import { PrimaryDatabaseService } from '../services/primary-database.service';

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

// One join of a select: a table, or a subquery; a lateral subquery may read the rows joined before it
export interface RepositoryJoin {
  table: PgTable | Subquery;
  on: SQL | undefined;
  lateral?: boolean;
}

// The joins a select can take — the single forms are kept for callers that join once
export interface RepositoryJoins {
  innerJoin?: RepositoryJoin;
  innerJoins?: RepositoryJoin[];
  leftJoin?: RepositoryJoin;
  leftJoins?: RepositoryJoin[];
}

// Adds the inner joins, then the left joins, in the order given; a lateral join with no condition joins on true
function applyJoins(query: AnyPgAsyncSelect, joins: RepositoryJoins | undefined): AnyPgAsyncSelect {
  const inner = [...(joins?.innerJoin ? [joins.innerJoin] : []), ...(joins?.innerJoins ?? [])];
  const left = [...(joins?.leftJoin ? [joins.leftJoin] : []), ...(joins?.leftJoins ?? [])];
  let joined = query;
  for (const join of inner) {
    joined = (
      join.lateral
        ? joined.innerJoinLateral(join.table as Subquery, join.on ?? sql`true`)
        : joined.innerJoin(join.table as PgTable, join.on)
    ) as AnyPgAsyncSelect;
  }
  for (const join of left) {
    joined = (
      join.lateral
        ? joined.leftJoinLateral(join.table as Subquery, join.on ?? sql`true`)
        : joined.leftJoin(join.table as PgTable, join.on)
    ) as AnyPgAsyncSelect;
  }
  return joined;
}

export abstract class PrimaryBaseRepository<
  TTable extends PgTable | PgViewBase,
  TInsert = TTable extends PgTable ? InferInsertModel<TTable> : never,
  TSelect = TTable extends PgTable
    ? InferSelectModel<TTable>
    : TTable extends PgViewBase
      ? InferSelectViewModel<TTable>
      : never,
> {
  protected readonly logger: Logger;
  protected readonly sequence?: PgSequence;

  private readonly tableName: string;
  private readonly isView: boolean;

  protected get db(): TypedDrizzleClient {
    return this.database.drizzleClient;
  }

  protected get model(): TypedRelationalQueryBuilder<TSelect> {
    if (this.isView) {
      throw new Error(
        `${this.constructor.name}: relational queries (.model) are not supported on the view '${this.tableName}'. Use findForSelect / findAllAndCount instead.`,
      );
    }

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
    options?: {
      sequence?: PgSequence;
    },
  ) {
    // Convert snake_case table/view name to camelCase to match Drizzle query object keys
    this.isView = is(table, PgViewBase);
    const dbTableName = this.isView ? getViewName(table as PgViewBase) : getTableName(table as PgTable);
    this.tableName = snakeToCamel(dbTableName);
    this.sequence = options?.sequence;
    this.logger = new Logger(this.constructor.name);
    this.logger.debug(`Initialized ${this.constructor.name}`);
    this.logger.debug(`Table name: '${dbTableName}' -> query key: '${this.tableName}'`);
  }

  // Returns next value from configured sequence, or an explicitly passed sequence
  protected async nextSequenceValue(sequence?: PgSequence): Promise<number> {
    const resolvedSequence = sequence ?? this.sequence;
    if (!resolvedSequence) {
      throw new Error(`${this.constructor.name}: sequence is required for nextSequenceValue`);
    }

    const sequenceName = resolvedSequence.schema
      ? `${resolvedSequence.schema}.${resolvedSequence.seqName}`
      : resolvedSequence.seqName;

    const result = await this.db.execute<{ sequence_value: number }>(
      sql`select nextval(${sequenceName}::regclass) as sequence_value`,
    );
    const rows = (result as { rows?: Array<{ sequence_value: number | string }> }).rows ?? [];
    return Number(rows[0]?.sequence_value ?? 1);
  }

  // Creates a new record and returns it
  async create(data: TInsert, tx?: TypedDrizzleClient): Promise<TSelect> {
    this.logger.log('Creating record');
    const db = tx ?? this.db;
    const results = (await db
      .insert(this.table as PgTable)
      .values(data as Record<string, unknown>)
      .returning()) as TSelect[];
    const record = results[0];
    if (!record) throw new Error(`${this.tableName}: database operation returned no record`);
    return record;
  }

  // Finds a single record by primary key ID. Given select (and joins) the row carries computed columns too —
  // scalar subqueries, CASE expressions, joined values — none of which the relational builder's column pick-list can
  // express. A where narrows the match further (ANDed with the id), so a row that fails it reads as not found.
  // Without options this is the plain relational read, so a caller that wants the bare row passes nothing.
  async findById<TResult = TSelect>(
    id: string,
    options?: {
      select?: Record<string, unknown>;
      where?: SQL;
      innerJoin?: RepositoryJoin;
      innerJoins?: RepositoryJoin[];
      leftJoin?: RepositoryJoin;
      leftJoins?: RepositoryJoin[];
      groupBy?: (PgColumn | SQL)[];
    },
  ): Promise<TResult | undefined> {
    this.logger.debug(`Finding record by ID: ${id}`);
    if (!options || Object.keys(options).length === 0) {
      return this.model.findFirst({ where: { id } }) as Promise<TResult | undefined>;
    }
    const idColumn = (this.table as unknown as Record<string, PgColumn>).id;
    if (!idColumn) throw new Error(`Table '${this.tableName}' has no 'id' column`);
    const rows = (await this.buildSelectQuery({
      ...options,
      where: options.where ? and(eq(idColumn, id), options.where) : eq(idColumn, id),
      limit: 1,
    })) as unknown as TResult[];
    return rows[0];
  }

  // The list form: rows matching a SQL condition, with computed columns and no count query. findAllAndCount pays for
  // a second query to report a total that a caller which already has its ids does not need.
  async findAllWithSelect<TResult = TSelect>(options: {
    select?: Record<string, unknown>;
    where?: SQL;
    orderBy?: SQL[];
    innerJoin?: RepositoryJoin;
    innerJoins?: RepositoryJoin[];
    leftJoin?: RepositoryJoin;
    leftJoins?: RepositoryJoin[];
    groupBy?: (PgColumn | SQL)[];
  }): Promise<TResult[]> {
    return this.buildSelectQuery(options) as unknown as Promise<TResult[]>;
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

  // Builds a select query with optional custom fields, joins, filter, grouping, ordering, and pagination
  private buildSelectQuery(options?: {
    select?: Record<string, unknown>;
    where?: SQL;
    orderBy?: SQL[];
    limit?: number;
    offset?: number;
    innerJoin?: RepositoryJoin;
    innerJoins?: RepositoryJoin[];
    leftJoin?: RepositoryJoin;
    leftJoins?: RepositoryJoin[];
    groupBy?: (PgColumn | SQL)[];
  }) {
    // Type as the concrete async select and cast each reassignment — Drizzle's dynamic builder returns union types.
    let query = (
      options?.select
        ? this.db.select(options.select as SelectedFields).from(this.table as PgTable)
        : this.db.select().from(this.table as PgTable)
    ).$dynamic() as AnyPgAsyncSelect;

    query = applyJoins(query, options);
    if (options?.where) {
      query = query.where(options.where) as AnyPgAsyncSelect;
    }
    if (options?.groupBy?.length) {
      query = query.groupBy(...options.groupBy) as AnyPgAsyncSelect;
    }
    if (options?.orderBy?.length) {
      query = query.orderBy(...options.orderBy) as AnyPgAsyncSelect;
    }
    if (options?.limit) {
      query = query.limit(options.limit) as AnyPgAsyncSelect;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as AnyPgAsyncSelect;
    }
    return query;
  }

  // Returns paginated result and total count, with optional custom select, LEFT JOINs, GROUP BY, and ordering
  async findAllAndCount<TResult = TSelect>(options?: {
    select?: Record<string, unknown>;
    where?: SQL;
    orderBy?: SQL[];
    limit?: number;
    offset?: number;
    innerJoin?: RepositoryJoin;
    innerJoins?: RepositoryJoin[];
    leftJoin?: RepositoryJoin;
    leftJoins?: RepositoryJoin[];
    groupBy?: (PgColumn | SQL)[];
  }): Promise<{ result: TResult[]; count: number }> {
    let countResultPromise: Promise<{ count: number }[]>;

    if (options?.groupBy?.length) {
      // When groupBy is active, wrap the grouped query in a subquery so we count distinct groups.
      let subq = applyJoins(
        this.db
          .select({ _: sql`1` })
          .from(this.table as PgTable)
          .$dynamic() as AnyPgAsyncSelect,
        options,
      );
      if (options.where) {
        subq = subq.where(options.where) as AnyPgAsyncSelect;
      }
      subq = subq.groupBy(...options.groupBy) as AnyPgAsyncSelect;

      const named = subq.as('_count_subq');
      countResultPromise = this.db.select({ count: sql<number>`count(*)::int` }).from(named) as unknown as Promise<
        { count: number }[]
      >;
    } else {
      // Count query mirrors the same JOINs so WHERE clauses on joined columns are valid
      let countQuery = applyJoins(
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.table as PgTable)
          .$dynamic() as AnyPgAsyncSelect,
        options,
      );
      if (options?.where) {
        countQuery = countQuery.where(options.where) as AnyPgAsyncSelect;
      }
      countResultPromise = countQuery as unknown as Promise<{ count: number }[]>;
    }

    const [countResult, result] = await Promise.all([
      countResultPromise,
      this.buildSelectQuery(options) as unknown as Promise<TResult[]>,
    ]);
    return { result, count: (countResult[0] as { count: number }).count };
  }

  // Fetches limit+1 rows for keyset pagination and trims, returning rows plus hasMore.
  async findKeyset<TResult = TSelect>(options: {
    select?: Record<string, unknown>;
    where?: SQL;
    orderBy: SQL[];
    limit: number;
    leftJoin?: RepositoryJoin;
    leftJoins?: RepositoryJoin[];
    groupBy?: (PgColumn | SQL)[];
  }): Promise<{ rows: TResult[]; hasMore: boolean }> {
    // Floor the page at one row (limit+1 and the trim below need a positive integer), then fetch
    // limit+1 to detect hasMore
    const limit = Math.max(1, Math.trunc(options.limit) || 1);
    const rows = (await this.buildSelectQuery({
      ...options,
      limit: limit + 1,
    })) as unknown as TResult[];
    const hasMore = rows.length > limit;
    return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
  }

  // Updates a record by ID and returns the updated record
  async update(id: string, data: Partial<TInsert>, tx?: TypedDrizzleClient): Promise<TSelect> {
    this.logger.log(`Updating record with ID: ${id}`);
    const db = tx ?? this.db;
    const idColumn = (this.table as unknown as Record<string, PgColumn>).id;
    if (!idColumn) throw new Error(`Table '${this.tableName}' has no 'id' column`);
    const results = (await db
      .update(this.table as PgTable)
      .set(data as Record<string, unknown>)
      .where(eq(idColumn, id))
      .returning()) as TSelect[];
    const record = results[0];
    if (!record) throw new Error(`${this.tableName}: database operation returned no record`);
    return record;
  }

  // Updates all records matching the SQL condition and returns the affected count
  async updateMany(where: SQL, data: Partial<TInsert>, tx?: TypedDrizzleClient): Promise<{ count: number }> {
    this.logger.log('Updating multiple records');
    const db = tx ?? this.db;
    const result = await db
      .update(this.table as PgTable)
      .set(data as Record<string, unknown>)
      .where(where);
    return { count: result.rowCount ?? 0 };
  }

  // Deletes a record by ID and returns the deleted record
  async delete(id: string, tx?: TypedDrizzleClient): Promise<TSelect> {
    this.logger.log(`Deleting record with ID: ${id}`);
    const db = tx ?? this.db;
    const idColumn = (this.table as unknown as Record<string, PgColumn>).id;
    if (!idColumn) throw new Error(`Table '${this.tableName}' has no 'id' column`);
    const results = (await db
      .delete(this.table as PgTable)
      .where(eq(idColumn, id))
      .returning()) as TSelect[];
    const record = results[0];
    if (!record) throw new Error(`${this.tableName}: database operation returned no record`);
    return record;
  }

  // Deletes all records matching the SQL condition and returns the affected count
  async deleteMany(where: SQL, tx?: TypedDrizzleClient): Promise<{ count: number }> {
    this.logger.log('Deleting multiple records');
    const db = tx ?? this.db;
    const result = await db.delete(this.table as PgTable).where(where);
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

  // Executes the callback within a database transaction, applying the ALS RLS context once at BEGIN.
  async transaction<T>(callback: (tx: TypedDrizzleClient) => Promise<T>): Promise<T> {
    return this.database.runInTransaction(async () => callback(this.database.drizzleClient));
  }

  // Finds records formatted as select dropdown options with optional search, pagination, and grouping
  async findForSelect(config: FindForSelectConfig): Promise<SelectQueryResult> {
    this.logger.debug('Finding records for select dropdown');

    // Use selectDistinct when deduplication is needed (e.g., distinct app codes across versions)
    const selectFn = config.distinct ? this.db.selectDistinct.bind(this.db) : this.db.select.bind(this.db);

    interface SelectRow {
      value: string | number | boolean;
      label: string;
      description?: string;
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

    const tableColumns = this.table as unknown as Record<string, PgColumn>;

    const joinTables = config.joins?.map((join) => join.table as unknown as Record<string, PgColumn>) ?? [];
    const resolveColumn = (key: string): PgColumn | undefined => {
      if (tableColumns[key]) return tableColumns[key];
      for (const joinColumns of joinTables) {
        if (joinColumns[key]) return joinColumns[key];
      }
      return undefined;
    };

    const valueCol = resolveColumn(config.value);
    if (!valueCol) throw new Error(`Column '${config.value}' not found in table '${this.tableName}' or its joins`);

    // A label or description names a column, or is an expression over the table and its joins
    const resolveField = (field: string | SQL): PgColumn | SQL | undefined =>
      typeof field === 'string' ? resolveColumn(field) : field;

    const labelCol = resolveField(config.label);
    if (!labelCol) throw new Error(`Column '${config.label}' not found in table '${this.tableName}' or its joins`);

    const descriptionCol = config.description ? resolveField(config.description) : undefined;

    // The selector's scope — equality on a column of the table or a join, plus raw conditions — bounds both the search
    // and the lookup of already-picked values, so a picked value outside the scope is never resolved
    const scopeConditions: SQL[] = [];
    for (const [field, val] of Object.entries(config.where ?? {})) {
      const column = resolveColumn(field);
      if (column) scopeConditions.push(eq(column, val));
    }
    scopeConditions.push(...(config.conditions ?? []));

    const parseKeys = (input?: string | string[]): string[] => {
      if (!input) return [];
      const values = Array.isArray(input) ? input : input.split(',');
      return values.map((v) => v.trim()).filter(Boolean);
    };
    const additionalKeys = parseKeys(config.additionalKeys);
    const additionalEntries: { key: string; expr: PgColumn | SQL }[] = [
      ...additionalKeys
        .map((key) => ({ key, expr: resolveColumn(key) as PgColumn | undefined }))
        .filter((e): e is { key: string; expr: PgColumn } => Boolean(e.expr)),
      ...Object.entries(config.additionalExpressions ?? {}).map(([key, expr]) => ({ key, expr })),
    ];
    const additionalAlias = (key: string) => `__additional_${key}`;
    // Driver-parsed json passes through untouched; only a value with no JSON shape (a Date, a Buffer) is stringified
    const isSelectAdditionalValue = (value: unknown): value is SelectAdditionalValue =>
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value) ||
      (typeof value === 'object' && value.constructor === Object);

    // When values are provided, fetch those specific options by value (skip search/pagination)
    if (parsedValues && parsedValues.length > 0) {
      const selectCols: Record<string, PgColumn | SQL> = { value: valueCol, label: labelCol };
      if (descriptionCol) selectCols.description = descriptionCol;
      if (config.groupIdKey) {
        const groupIdCol = resolveColumn(config.groupIdKey);
        if (groupIdCol) selectCols.groupId = groupIdCol;
      }
      for (const entry of additionalEntries) {
        selectCols[additionalAlias(entry.key)] = entry.expr;
      }

      let valuesQuery = selectFn(selectCols as SelectedFields)
        .from(this.table as PgTable)
        .$dynamic();

      if (config.joins) {
        for (const join of config.joins) {
          if (join.type === 'inner') {
            valuesQuery = valuesQuery.innerJoin(join.table, join.on);
          } else {
            valuesQuery = valuesQuery.leftJoin(join.table, join.on);
          }
        }
      }

      const rows = await valuesQuery.where(and(inArray(valueCol, parsedValues), ...scopeConditions));

      return {
        options: (rows as unknown as SelectRow[]).map((row) => ({
          value: row.value,
          label: String(row.label),
          ...(descriptionCol && row.description != null ? { description: String(row.description) } : {}),
          ...(config.groupIdKey && row.groupId != null ? { groupId: row.groupId } : {}),
          ...(additionalEntries.length > 0
            ? {
                additionals: additionalEntries.reduce<Record<string, SelectAdditionalValue>>((acc, entry) => {
                  const value = (row as unknown as Record<string, unknown>)[additionalAlias(entry.key)];
                  if (value !== undefined) {
                    acc[entry.key] = isSelectAdditionalValue(value) ? value : String(value);
                  }
                  return acc;
                }, {}),
              }
            : {}),
        })),
        hasMore: false,
        ...(config.groups ? { groups: config.groups } : {}),
      };
    }

    // Use SQL builder for count(*) over() window function support
    // A window count runs before DISTINCT, so a distinct select counts its distinct rows in a separate query instead
    const selectFields: Record<string, PgColumn | SQL> = {
      value: valueCol,
      label: labelCol,
      ...(config.distinct ? {} : { totalCount: sql<number>`count(*) over()`.mapWith(Number) }),
    };
    if (descriptionCol) selectFields.description = descriptionCol;
    if (config.groupIdKey) {
      const groupIdCol = resolveColumn(config.groupIdKey);
      if (groupIdCol) selectFields.groupId = groupIdCol;
    }
    for (const entry of additionalEntries) {
      selectFields[additionalAlias(entry.key)] = entry.expr;
    }

    const conditions: SQL[] = [];
    // Search matches the label unless the caller names the columns, which may sit on a joined table
    if (config.search) {
      const searchCols = config.searchKeys?.length
        ? config.searchKeys.map((key) => {
            const col = resolveColumn(key);
            if (!col) throw new Error(`Search column '${key}' not found in table '${this.tableName}' or its joins`);
            return col;
          })
        : [labelCol];
      const matches = searchCols.map((col) => ilike(col, `%${config.search}%`));
      conditions.push(or(...matches) as SQL);
    }
    if (parsedExcludeIds.length > 0) {
      conditions.push(notInArray(valueCol, parsedExcludeIds));
    }
    conditions.push(...scopeConditions);

    // Every sort key in order — orderByKey alone, else each orderBy entry; a key may name a joined table's column, and
    // an unknown key sorts by the label
    const sortKeys: [string, 'asc' | 'desc'][] = config.orderByKey
      ? [[config.orderByKey, config.orderDirection ?? 'asc']]
      : Object.entries(config.orderBy ?? {});
    const sortClauses = sortKeys.map(([key, direction]) => {
      const column = resolveColumn(key) ?? labelCol;
      return direction === 'desc' ? desc(column) : asc(column);
    });
    const limit = Number(config.limit) || 20;
    const offset = Number(config.offset) || 0;

    // The options' rows: the table with its joins, narrowed by the search, the exclusions and the scope
    const filteredSelect = () => {
      let filtered = selectFn(selectFields as SelectedFields)
        .from(this.table as PgTable)
        .$dynamic();
      for (const join of config.joins ?? []) {
        filtered =
          join.type === 'inner' ? filtered.innerJoin(join.table, join.on) : filtered.leftJoin(join.table, join.on);
      }
      return conditions.length > 0 ? filtered.where(and(...conditions) as SQL) : filtered;
    };

    const orderClauses: SQL[] = [];
    if (config.groupIdKey) {
      const groupIdCol = resolveColumn(config.groupIdKey);
      if (groupIdCol) orderClauses.push(asc(groupIdCol));
    }
    orderClauses.push(...(sortClauses.length > 0 ? sortClauses : [asc(labelCol)]));

    const query = filteredSelect()
      .orderBy(...orderClauses)
      .limit(limit)
      .offset(offset);

    const [rows, distinctCount] = await Promise.all([
      query,
      config.distinct
        ? this.db.select({ count: sql<number>`count(*)::int` }).from(filteredSelect().as('distinct_options'))
        : undefined,
    ]);

    const totalCount = distinctCount
      ? (distinctCount[0]?.count ?? 0)
      : rows.length > 0
        ? (rows[0] as unknown as SelectRowWithCount).totalCount
        : 0;

    const options = (rows as unknown as SelectRow[]).map((row) => ({
      value: row.value,
      label: String(row.label),
      ...(descriptionCol && row.description != null ? { description: String(row.description) } : {}),
      ...(config.groupIdKey && row.groupId != null ? { groupId: row.groupId } : {}),
      ...(additionalEntries.length > 0
        ? {
            additionals: additionalEntries.reduce<Record<string, SelectAdditionalValue>>((acc, entry) => {
              const value = (row as unknown as Record<string, unknown>)[additionalAlias(entry.key)];
              if (value !== undefined) {
                acc[entry.key] = isSelectAdditionalValue(value) ? value : String(value);
              }
              return acc;
            }, {}),
          }
        : {}),
    }));

    // Auto-resolve groups from groupTable when provided
    let resolvedGroups = config.groups;

    if (config.groupTable && config.groupIdKey) {
      const groupTableColumns = config.groupTable as unknown as Record<string, PgColumn>;
      const groupIdKey = config.groupTableIdKey ?? 'id';
      const groupNameKey = config.groupLabelKey ?? 'name';
      const groupIdCol = groupTableColumns[groupIdKey];
      if (!groupIdCol) throw new Error(`Column '${groupIdKey}' not found in group table`);
      const groupNameCol = groupTableColumns[groupNameKey];
      if (!groupNameCol) throw new Error(`Column '${groupNameKey}' not found in group table`);

      const groupRows = await this.db
        .select({ id: groupIdCol, name: groupNameCol } as SelectedFields)
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

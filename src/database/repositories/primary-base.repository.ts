import { Logger } from '@nestjs/common';
import {
  eq,
  sql,
  SQL,
  getTableName,
  InferInsertModel,
  InferSelectModel,
} from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { PrimaryDatabaseService } from '../services/primary-database.service';
import type { TypedDrizzleClient } from '../schema.registry';

/**
 * Type-safe wrapper for Drizzle's RelationalQueryBuilder.
 * This interface matches the method signatures of RelationalQueryBuilder
 * but properly binds the TSelect generic for type safety.
 *
 * We use this instead of RelationalQueryBuilder directly because
 * TypeScript cannot infer TSelect from the generic base repository context.
 */
interface TypedRelationalQueryBuilder<TSelect> {
  findFirst(config?: {
    where?: SQL;
    with?: Record<string, unknown>;
    columns?: Record<string, boolean>;
  }): Promise<TSelect | undefined>;

  findMany(config?: {
    where?: SQL;
    orderBy?: SQL;
    limit?: number;
    offset?: number;
    with?: Record<string, unknown>;
    columns?: Record<string, boolean>;
  }): Promise<TSelect[]>;
}

/**
 * Abstract base repository for primary database operations using Drizzle ORM.
 * Provides common CRUD operations with automatic logging.
 *
 * @template TTable - The Drizzle table type (must be registered in SchemaRegistry)
 * @template TInsert - Type for insert operations (inferred from table.$inferInsert)
 * @template TSelect - Type for select operations (inferred from table.$inferSelect)
 *
 * @remarks
 * **Type Assertion Pattern:** This repository uses `as any` casts when passing
 * the generic table to Drizzle methods. This is necessary because TypeScript
 * cannot prove that a generic `TTable extends PgTable` satisfies Drizzle's
 * stricter internal type requirements for `insert()`, `update()`, and `delete()`.
 *
 * The public API maintains full type safety:
 * - Input parameters are typed as `TInsert` (inferred from table)
 * - Return values are typed as `TSelect` (inferred from table)
 * - The casts are implementation details that don't leak to consumers
 *
 * @example
 * ```typescript
 * import { users } from '@/db/schema';
 *
 * type User = typeof users.$inferSelect;
 * type NewUser = typeof users.$inferInsert;
 *
 * @Injectable()
 * export class UserRepository extends PrimaryBaseRepository<typeof users> {
 *   constructor(database: PrimaryDatabaseService) {
 *     super(database, users);
 *   }
 *
 *   // Use Prisma-like relational query syntax (recommended)
 *   async findByEmail(email: string): Promise<User | undefined> {
 *     return this.model.findFirst({
 *       where: eq(users.email, email),
 *     });
 *   }
 *
 *   // Use Prisma-like with relations
 *   async findWithRelations(id: string): Promise<User | undefined> {
 *     return this.model.findFirst({
 *       where: eq(users.id, id),
 *       with: { posts: true, profile: true }
 *     });
 *   }
 * }
 * ```
 */
export abstract class PrimaryBaseRepository<
  TTable extends PgTable,
  TInsert = InferInsertModel<TTable>,
  TSelect = InferSelectModel<TTable>,
> {
  protected readonly logger: Logger;

  /**
   * The table name extracted from the Drizzle table at runtime.
   * Used to access the query API for this repository's table.
   */
  private readonly tableName: string;

  /**
   * Lazy getter for Drizzle client.
   * Accesses the client from the database service only when needed,
   * avoiding initialization timing issues with NestJS lifecycle.
   */
  protected get db(): TypedDrizzleClient {
    return this.database.drizzleClient;
  }

  /**
   * Model query API for THIS repository's table (Prisma-like syntax)
   * Scoped to only the table this repository manages.
   * Returns a type-safe wrapper around Drizzle's RelationalQueryBuilder.
   *
   * @example
   * ```typescript
   * // Use relational queries with type safety
   * const user = await this.model.findFirst({
   *   where: eq(users.id, id),
   *   with: { posts: true, profile: true }
   * });
   * ```
   */
  protected get model(): TypedRelationalQueryBuilder<TSelect> {
    return this.database.drizzleClient.query[
      this.tableName as keyof TypedDrizzleClient['query']
    ] as unknown as TypedRelationalQueryBuilder<TSelect>;
  }

  /**
   * Create a new repository instance
   *
   * @param database - The primary database service
   * @param table - The Drizzle table schema object
   *
   * @example
   * ```typescript
   * import { users } from '@/db/schema';
   *
   * constructor(database: PrimaryDatabaseService) {
   *   super(database, users);
   * }
   * ```
   */
  constructor(
    protected readonly database: PrimaryDatabaseService,
    protected readonly table: TTable,
  ) {
    this.tableName = getTableName(table);
    this.logger = new Logger(this.constructor.name);
    this.logger.debug(`Initialized ${this.constructor.name}`);
  }

  /**
   * Create a new record
   *
   * @param data - The data to create the record with
   * @returns Promise resolving to the created record
   *
   * @example
   * ```typescript
   * const user = await userRepository.create({
   *   email: 'user@example.com',
   *   firstName: 'John'
   * });
   * ```
   */
  async create(data: TInsert): Promise<TSelect> {
    this.logger.log('Creating record');
    const results = (await this.db
      .insert(this.table as any)
      .values(data as any)
      .returning()) as TSelect[];
    return results[0]!;
  }

  /**
   * Find a single record by ID
   *
   * @param id - The record ID
   * @returns Promise resolving to the record or undefined if not found
   *
   * @example
   * ```typescript
   * const user = await userRepository.findById('user-id-123');
   * ```
   */
  async findById(id: string): Promise<TSelect | undefined> {
    this.logger.debug(`Finding record by ID: ${id}`);
    const idColumn = (this.table as any).id;
    return this.model.findFirst({
      where: eq(idColumn, id),
    });
  }

  /**
   * Find a single record with custom where clause
   *
   * @param where - SQL condition
   * @returns Promise resolving to the record or undefined if not found
   *
   * @example
   * ```typescript
   * import { eq } from 'drizzle-orm';
   * const user = await userRepository.findOne(eq(users.email, 'user@example.com'));
   * ```
   */
  async findOne(where: SQL): Promise<TSelect | undefined> {
    this.logger.debug('Finding record with custom query');
    return this.model.findFirst({ where });
  }

  /**
   * Find multiple records
   *
   * @param options - Query options (where, orderBy, limit, offset)
   * @returns Promise resolving to an array of records
   *
   * @example
   * ```typescript
   * import { eq, desc } from 'drizzle-orm';
   *
   * // Find all users
   * const users = await userRepository.findMany();
   *
   * // Find with filtering and pagination
   * const users = await userRepository.findMany({
   *   where: eq(users.accountStatus, 'ACTIVE'),
   *   orderBy: desc(users.createdAt),
   *   limit: 10,
   *   offset: 0
   * });
   * ```
   */
  async findMany(options?: {
    where?: SQL;
    orderBy?: SQL;
    limit?: number;
    offset?: number;
  }): Promise<TSelect[]> {
    this.logger.debug('Finding multiple records');
    return this.model.findMany(options);
  }

  /**
   * Update a record by ID
   *
   * @param id - The record ID
   * @param data - The data to update
   * @returns Promise resolving to the updated record
   *
   * @example
   * ```typescript
   * const user = await userRepository.update('user-id-123', {
   *   firstName: 'Jane'
   * });
   * ```
   */
  async update(id: string, data: Partial<TInsert>): Promise<TSelect> {
    this.logger.log(`Updating record with ID: ${id}`);
    const idColumn = (this.table as any).id;
    const results = (await this.db
      .update(this.table as any)
      .set(data as any)
      .where(eq(idColumn, id))
      .returning()) as TSelect[];
    return results[0]!;
  }

  /**
   * Update multiple records
   *
   * @param where - SQL condition to match records
   * @param data - The data to update
   * @returns Promise resolving to the count of updated records
   *
   * @example
   * ```typescript
   * import { eq } from 'drizzle-orm';
   *
   * const result = await userRepository.updateMany(
   *   eq(users.accountStatus, 'PENDING'),
   *   { accountStatus: 'ACTIVE' }
   * );
   * console.log(`Updated ${result.count} users`);
   * ```
   */
  async updateMany(
    where: SQL,
    data: Partial<TInsert>,
  ): Promise<{ count: number }> {
    this.logger.log('Updating multiple records');
    const result = await this.db
      .update(this.table as any)
      .set(data as any)
      .where(where);
    return { count: result.rowCount ?? 0 };
  }

  /**
   * Delete a record by ID
   *
   * @param id - The record ID
   * @returns Promise resolving to the deleted record
   *
   * @example
   * ```typescript
   * const user = await userRepository.delete('user-id-123');
   * ```
   */
  async delete(id: string): Promise<TSelect> {
    this.logger.log(`Deleting record with ID: ${id}`);
    const idColumn = (this.table as any).id;
    const results = (await this.db
      .delete(this.table as any)
      .where(eq(idColumn, id))
      .returning()) as TSelect[];
    return results[0]!;
  }

  /**
   * Delete multiple records
   *
   * @param where - SQL condition to match records
   * @returns Promise resolving to the count of deleted records
   *
   * @example
   * ```typescript
   * import { lt } from 'drizzle-orm';
   *
   * const result = await userRepository.deleteMany(
   *   lt(users.createdAt, new Date('2020-01-01'))
   * );
   * console.log(`Deleted ${result.count} users`);
   * ```
   */
  async deleteMany(where: SQL): Promise<{ count: number }> {
    this.logger.log('Deleting multiple records');
    const result = await this.db.delete(this.table as any).where(where);
    return { count: result.rowCount ?? 0 };
  }

  /**
   * Count records
   *
   * @param where - Optional SQL condition to filter records
   * @returns Promise resolving to the count of records
   *
   * @example
   * ```typescript
   * import { eq } from 'drizzle-orm';
   *
   * // Count all users
   * const total = await userRepository.count();
   *
   * // Count active users
   * const activeCount = await userRepository.count(
   *   eq(users.accountStatus, 'ACTIVE')
   * );
   * ```
   */
  async count(where?: SQL): Promise<number> {
    this.logger.debug('Counting records');

    let query = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table as any)
      .$dynamic();

    if (where) {
      query = query.where(where);
    }

    const results = await query;
    return (results[0] as { count: number }).count;
  }

  /**
   * Check if a record exists
   *
   * @param where - SQL condition to match records
   * @returns Promise resolving to true if at least one record exists, false otherwise
   *
   * @example
   * ```typescript
   * import { eq } from 'drizzle-orm';
   *
   * const emailExists = await userRepository.exists(
   *   eq(users.email, 'user@example.com')
   * );
   * ```
   */
  async exists(where: SQL): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }
}

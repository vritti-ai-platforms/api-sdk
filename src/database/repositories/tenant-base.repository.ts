import { Logger } from '@nestjs/common';
import { eq, getTableName, type InferInsertModel, type InferSelectModel, type SQL, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { TypedDrizzleClient } from '../schema.registry';
import { TenantDatabaseService } from '../services/tenant-database.service';

/**
 * Type helper to extract table name from Drizzle table.
 * TTable['_']['name'] gives us the string literal type (e.g., 'products')
 */
type ExtractTableName<TTable extends PgTable> = TTable['_']['name'];

/**
 * Abstract base repository for tenant-scoped database operations using Drizzle ORM.
 * All operations are automatically scoped to the current tenant.
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
 * import { products } from '@/db/schema';
 *
 * type Product = typeof products.$inferSelect;
 * type NewProduct = typeof products.$inferInsert;
 *
 * @Injectable()
 * export class ProductRepository extends TenantBaseRepository<typeof products> {
 *   constructor(database: TenantDatabaseService) {
 *     super(database, products);
 *   }
 *
 *   // Use SQL-builder syntax
 *   async findBySku(sku: string): Promise<Product | null> {
 *     const [result] = await this.db
 *       .select()
 *       .from(this.table)
 *       .where(eq(products.sku, sku))
 *       .limit(1);
 *     return result ?? null;
 *   }
 *
 *   // Use Prisma-like relational query syntax
 *   async findWithRelations(id: string): Promise<Product | null> {
 *     return await this.model.findFirst({
 *       where: eq(products.id, id),
 *       with: { category: true, variants: true }
 *     });
 *   }
 * }
 * ```
 */
export abstract class TenantBaseRepository<
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
   * Scoped to only the table this repository manages
   *
   * @example
   * ```typescript
   * // Use relational queries with type safety
   * const product = await this.model.findFirst({
   *   where: eq(products.id, id),
   *   with: { category: true, variants: true }
   * });
   * ```
   */
  protected get model(): TypedDrizzleClient['query'][ExtractTableName<TTable> & keyof TypedDrizzleClient['query']] {
    return this.database.drizzleClient.query[
      this.tableName as ExtractTableName<TTable> & keyof TypedDrizzleClient['query']
    ];
  }

  /**
   * Create a new repository instance
   *
   * @param database - The tenant database service
   * @param table - The Drizzle table schema object
   *
   * @example
   * ```typescript
   * import { products } from '@/db/schema';
   *
   * constructor(database: TenantDatabaseService) {
   *   super(database, products);
   * }
   * ```
   */
  constructor(
    protected readonly database: TenantDatabaseService,
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
   * const product = await productRepository.create({
   *   name: 'Widget',
   *   sku: 'WDG-001',
   *   price: 9.99
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
   * @returns Promise resolving to the record or null if not found
   *
   * @example
   * ```typescript
   * const product = await productRepository.findById('product-id-123');
   * ```
   */
  async findById(id: string): Promise<TSelect | null> {
    this.logger.debug(`Finding record by ID: ${id}`);
    const idColumn = (this.table as any).id;
    const results = await this.db
      .select()
      .from(this.table as any)
      .where(eq(idColumn, id))
      .limit(1);
    return (results[0] as TSelect) ?? null;
  }

  /**
   * Find a single record with custom where clause
   *
   * @param where - SQL condition
   * @returns Promise resolving to the record or null if not found
   *
   * @example
   * ```typescript
   * import { eq } from 'drizzle-orm';
   * const product = await productRepository.findOne(eq(products.sku, 'WDG-001'));
   * ```
   */
  async findOne(where: SQL): Promise<TSelect | null> {
    this.logger.debug('Finding record with custom query');
    const results = await this.db
      .select()
      .from(this.table as any)
      .where(where)
      .limit(1);
    return (results[0] as TSelect) ?? null;
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
   * // Find all products
   * const products = await productRepository.findMany();
   *
   * // Find with filtering and pagination
   * const products = await productRepository.findMany({
   *   where: eq(products.status, 'ACTIVE'),
   *   orderBy: desc(products.createdAt),
   *   limit: 10,
   *   offset: 0
   * });
   * ```
   */
  async findMany(options?: { where?: SQL; orderBy?: SQL; limit?: number; offset?: number }): Promise<TSelect[]> {
    this.logger.debug('Finding multiple records');

    let query = this.db
      .select()
      .from(this.table as any)
      .$dynamic();

    if (options?.where) {
      query = query.where(options.where);
    }
    if (options?.orderBy) {
      query = query.orderBy(options.orderBy);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return (await query) as TSelect[];
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
   * const product = await productRepository.update('product-id-123', {
   *   price: 12.99
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
   * const result = await productRepository.updateMany(
   *   eq(products.status, 'PENDING'),
   *   { status: 'ACTIVE' }
   * );
   * console.log(`Updated ${result.count} products`);
   * ```
   */
  async updateMany(where: SQL, data: Partial<TInsert>): Promise<{ count: number }> {
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
   * const product = await productRepository.delete('product-id-123');
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
   * const result = await productRepository.deleteMany(
   *   lt(products.createdAt, new Date('2020-01-01'))
   * );
   * console.log(`Deleted ${result.count} products`);
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
   * // Count all products
   * const total = await productRepository.count();
   *
   * // Count active products
   * const activeCount = await productRepository.count(
   *   eq(products.status, 'ACTIVE')
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
   * const skuExists = await productRepository.exists(
   *   eq(products.sku, 'WDG-001')
   * );
   * ```
   */
  async exists(where: SQL): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }
}

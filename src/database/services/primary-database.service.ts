import { AsyncLocalStorage } from 'node:async_hooks';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions } from '../interfaces';
import type { TypedDrizzleClient } from '../schema.registry';

@Injectable()
export class PrimaryDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrimaryDatabaseService.name);

  private pool: Pool | null = null;
  private db: TypedDrizzleClient | null = null;
  // Per-request pinned drizzle client (one PoolClient checked out for the whole request)
  private readonly als = new AsyncLocalStorage<TypedDrizzleClient>();

  constructor(
    @Inject(DATABASE_MODULE_OPTIONS)
    private readonly options: DatabaseModuleOptions,
  ) {}

  async onModuleInit() {
    if (this.options.primaryDb) {
      await this.initializeDrizzleClient();
    }
  }

  // Initializes connection to primary database using Drizzle
  private async initializeDrizzleClient(): Promise<void> {
    try {
      const { host, port = 5432, username, password, database, schema, sslMode = 'require' } = this.options.primaryDb;

      this.pool = new Pool({
        host,
        port,
        user: username,
        password,
        database,
        max: this.options.maxConnections || 10,
        ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode !== 'no-verify' },
        ...(schema && { options: `-csearch_path=${schema}` }),
      });

      this.logger.debug(`Schema keys passed to drizzle: [${Object.keys(this.options.drizzleSchema || {}).join(', ')}]`);
      this.logger.debug(
        `Relations keys passed to drizzle: [${Object.keys(this.options.drizzleRelations || {}).join(', ')}]`,
      );
      this.db = drizzle({
        client: this.pool,
        schema: this.options.drizzleSchema,
        relations: this.options.drizzleRelations,
      }) as TypedDrizzleClient;
      this.logger.debug(`Drizzle query keys after init: [${Object.keys(this.db.query || {}).join(', ')}]`);

      await this.pool.query('SELECT 1');
      this.logger.log(`Connected to primary database (schema: ${schema ?? 'public'})`);
    } catch (error) {
      this.logger.error('Failed to connect to primary database', error);
      throw new InternalServerErrorException('Failed to initialize database connection');
    }
  }

  // Returns the active Drizzle client — request-pinned client when inside runWithPinnedConnection,
  // otherwise the pool-backed singleton (each query checks out a different connection)
  get drizzleClient(): TypedDrizzleClient {
    const pinned = this.als.getStore();
    if (pinned) return pinned;
    if (!this.db) {
      throw new Error('Primary database client not initialized');
    }
    return this.db;
  }

  // Returns the Drizzle schema passed in module options
  get schema(): typeof this.options.drizzleSchema {
    return this.options.drizzleSchema;
  }

  // Runs `fn` inside a single transaction. All repository queries via drizzleClient
  // automatically use the transaction's pinned connection, ensuring per-connection
  // session state (e.g. SET LOCAL app.org_id for RLS) stays valid for every query
  // in the request and is discarded at commit/rollback.
  async runWithPinnedConnection<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error('Primary database client not initialized');
    }
    if (this.als.getStore()) {
      // Nested call — reuse existing pinned client (avoids nested transactions)
      return fn();
    }
    return this.db.transaction(async (tx) => this.als.run(tx as TypedDrizzleClient, fn));
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Disconnected from primary database');
    }
  }
}

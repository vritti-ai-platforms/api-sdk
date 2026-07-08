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
import type { PoolClient } from 'pg';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions } from '../interfaces';
import type { TypedDrizzleClient } from '../schema.registry';
import { RlsAwarePool } from './rls-aware-pool';

@Injectable()
export class PrimaryDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrimaryDatabaseService.name);

  private pool: RlsAwarePool | null = null;
  private db: TypedDrizzleClient | null = null;

  // Per-request RLS context read by RlsAwarePool per query and by runInTransaction at BEGIN.
  private readonly rlsAls = new AsyncLocalStorage<unknown>();

  // Active Drizzle transaction client so repository queries participate in the transaction.
  private readonly txAls = new AsyncLocalStorage<TypedDrizzleClient>();

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

      this.pool = new RlsAwarePool({
        host,
        port,
        user: username,
        password,
        database,
        max: this.options.maxConnections || 10,
        ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode !== 'no-verify' },
        ...(schema && { options: `-csearch_path=${schema}` }),
        rlsAls: this.rlsAls,
        txAls: this.txAls,
        applyRlsContext: this.options.applyRlsContext,
      });

      this.logger.debug(
        `Relations keys passed to drizzle: [${Object.keys(this.options.drizzleRelations || {}).join(', ')}]`,
      );
      this.db = drizzle({
        client: this.pool,
        relations: this.options.drizzleRelations,
      }) as unknown as TypedDrizzleClient;

      // Health check runs before any ALS scope is set → bypasses auto-wrap naturally.
      await this.pool.query('SELECT 1');
      this.logger.log(`Connected to primary database (schema: ${schema ?? 'public'})`);
    } catch (error) {
      this.logger.error('Failed to connect to primary database', error);
      throw new InternalServerErrorException('Failed to initialize database connection');
    }
  }

  // Returns the active Drizzle client — the pinned tx inside runInTransaction, else the pool-backed one.
  get drizzleClient(): TypedDrizzleClient {
    const pinned = this.txAls.getStore();
    if (pinned) return pinned;
    if (!this.db) {
      throw new Error('Primary database client not initialized');
    }
    return this.db;
  }

  // Stashes per-request RLS context in AsyncLocalStorage for downstream queries to apply via SET LOCAL.
  runWithRlsContext<T>(rls: unknown, fn: () => Promise<T>): Promise<T> {
    return this.rlsAls.run(rls, fn);
  }

  // Opens a transaction pinning all queries in `fn` to one connection, applying RLS once at BEGIN.
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const pinned = this.txAls.getStore();
    if (pinned) {
      return pinned.transaction(async (sp) => this.txAls.run(sp as TypedDrizzleClient, fn));
    }

    if (!this.db) {
      throw new Error('Primary database client not initialized');
    }
    const rls = this.rlsAls.getStore();
    const applyRls = this.options.applyRlsContext;

    return this.db.transaction(async (tx) => {
      if (rls !== undefined && applyRls) {
        // Drizzle's NodePgSession exposes the checked-out PoolClient at session.client for SET LOCAL binding.
        // biome-ignore lint/suspicious/noExplicitAny: drizzle internal session shape, stable across recent versions
        const sessionClient = (tx as any)?.session?.client as PoolClient | undefined;
        if (sessionClient) {
          await applyRls(sessionClient, rls);
        }
      }
      return this.txAls.run(tx as TypedDrizzleClient, fn);
    });
  }

  // Deprecated: prefer runInTransaction. Retained so existing callers keep working until migrated.
  async runWithPinnedConnection<T>(fn: () => Promise<T>): Promise<T> {
    return this.runInTransaction(fn);
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Disconnected from primary database');
    }
  }
}

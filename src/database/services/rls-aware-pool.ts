import type { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow, type Submittable } from 'pg';

export type ApplyRlsContextFn = (client: PoolClient, ctx: unknown) => Promise<void>;

export interface RlsAwarePoolOptions extends PoolConfig {
  rlsAls: AsyncLocalStorage<unknown>;
  txAls: AsyncLocalStorage<unknown>;
  applyRlsContext?: ApplyRlsContextFn;
}

export class RlsAwarePool extends Pool {
  private readonly rlsAls: AsyncLocalStorage<unknown>;
  private readonly txAls: AsyncLocalStorage<unknown>;
  private readonly applyRlsContext?: ApplyRlsContextFn;

  constructor(options: RlsAwarePoolOptions) {
    const { rlsAls, txAls, applyRlsContext, ...poolConfig } = options;
    super(poolConfig);
    this.rlsAls = rlsAls;
    this.txAls = txAls;
    this.applyRlsContext = applyRlsContext;
  }

  // biome-ignore lint/suspicious/noExplicitAny: matches pg.Pool.query overload surface
  override query(textOrConfig: any, values?: any, cb?: any): any {
    // Bypass: legacy callback-only form (text is actually a callback)
    if (typeof textOrConfig === 'function') {
      return super.query(textOrConfig);
    }
    // Bypass: Submittable (pg-cursor, pg-query-stream) — must reuse one Client end-to-end
    if (textOrConfig && typeof (textOrConfig as Submittable).submit === 'function') {
      return super.query(textOrConfig, values, cb);
    }
    // Bypass: callback variants — preserve raw signature
    if (typeof values === 'function' || typeof cb === 'function') {
      return super.query(textOrConfig, values, cb);
    }

    const rls = this.rlsAls.getStore();
    // Bypass: no RLS context (init queries, health checks) OR already inside an explicit transaction
    if (rls === undefined || this.txAls.getStore() !== undefined || !this.applyRlsContext) {
      return super.query(textOrConfig, values);
    }

    return this.runWrapped(textOrConfig, values, rls);
  }

  // biome-ignore lint/suspicious/noExplicitAny: dispatched from query() overload
  private async runWrapped(textOrConfig: any, values: any, rls: unknown): Promise<QueryResult<QueryResultRow>> {
    const client = await super.connect();
    try {
      await client.query('BEGIN');
      // applyRlsContext is non-null in this branch (checked in query())
      await (this.applyRlsContext as ApplyRlsContextFn)(client, rls);
      const result = await client.query(textOrConfig, values);
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // connection likely already dead — fall through to release with original error
      }
      // Passing an Error to release() tells pg-pool to evict the client instead of returning it to the pool.
      client.release(err as Error);
      throw err;
    }
  }
}

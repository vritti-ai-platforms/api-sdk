import type { PoolClient } from 'pg';

export interface PrimaryDbConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  database: string;
  schema?: string;
  sslMode?: 'require' | 'prefer' | 'disable' | 'no-verify';
}

export interface DatabaseModuleOptions {
  primaryDb: PrimaryDbConfig;
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle relations type is dynamic per app
  drizzleRelations?: Record<string, any>;
  maxConnections?: number;
  // Sets per-request session vars (e.g. SET LOCAL app.org_id) on the pooled connection
  // before each auto-wrapped query and once at the start of each explicit transaction.
  // `ctx` is whatever value the caller passed to PrimaryDatabaseService.runWithRlsContext().
  applyRlsContext?: (client: PoolClient, ctx: unknown) => Promise<void>;
}

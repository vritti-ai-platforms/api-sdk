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
  applyRlsContext?: (client: PoolClient, ctx: unknown) => Promise<void>;
}

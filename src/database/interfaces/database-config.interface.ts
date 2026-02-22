import type { RegisteredSchema } from '../schema.registry';

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

  drizzleSchema: RegisteredSchema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drizzleRelations?: Record<string, any>;

  connectionCacheTTL?: number;

  maxConnections?: number;

  encryptionKey?: string;
}

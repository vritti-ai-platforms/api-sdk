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
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle relations type is dynamic
  drizzleRelations?: Record<string, any>;
  maxConnections?: number;
}

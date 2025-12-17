/**
 * Primary database connection configuration
 */
export interface PrimaryDbConfig {
  /** Database host */
  host: string;

  /** Database port (default: 5432) */
  port?: number;

  /** Database username */
  username: string;

  /** Database password */
  password: string;

  /** Database name */
  database: string;

  /** Default schema (default: 'public') */
  schema?: string;

  /** SSL mode: 'require' | 'prefer' | 'disable' | 'no-verify' (default: 'require') */
  sslMode?: 'require' | 'prefer' | 'disable' | 'no-verify';
}

/**
 * Configuration options for DatabaseModule
 */
export interface DatabaseModuleOptions {
  /**
   * Primary database configuration (for tenant registry queries)
   * Only required in gateway mode
   * @example
   * primaryDb: {
   *   host: 'aws-pooler.supabase.com',
   *   port: 5432,
   *   username: 'postgres.xxx',
   *   password: 'xxx',
   *   database: 'postgres',
   *   schema: 'public',
   *   sslMode: 'require',
   * }
   */
  primaryDb: PrimaryDbConfig;

  /**
   * Primary database client constructor (for querying tenant registry)
   * Only required in gateway mode
   * @example import { PrismaClient } from './prisma/generated/prisma/client'
   */
  prismaClientConstructor: any;

  /**
   * Prisma adapter constructor for PostgreSQL (required for Prisma 7+)
   * @example import { PrismaPg } from '@prisma/adapter-pg'
   */
  prismaAdapterConstructor: any;

  /**
   * Connection cache TTL in milliseconds
   * Idle connections will be closed after this period
   * @default 300000 (5 minutes)
   */
  connectionCacheTTL?: number;

  /**
   * Maximum number of concurrent connections per tenant
   * @default 10
   */
  maxConnections?: number;

  /**
   * Encryption key for decrypting database credentials
   * Required if tenant config stores encrypted passwords
   */
  encryptionKey?: string;
}

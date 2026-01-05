import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, or } from 'drizzle-orm';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions, TenantInfo } from '../interfaces';
import type { TypedDrizzleClient } from '../schema.registry';

/**
 * Schema tables required for tenant resolution.
 *
 * @remarks
 * This service requires the schema to include `tenants` and `tenantDatabaseConfigs` tables.
 * Due to Drizzle's complex type system with generic tables and columns,
 * we use explicit casts when accessing these tables. The result types
 * (TenantRow, TenantDatabaseConfigRow) are properly typed for type safety.
 */
interface TenantSchemaRequirement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenants: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenantDatabaseConfigs: any;
}

/**
 * Type for the raw join result row from tenant query.
 * Uses string keys since Drizzle returns tables with their snake_case names.
 */
interface TenantJoinResultRow {
  tenants: TenantRow;
  tenant_database_configs: TenantDatabaseConfigRow | null;
}

/**
 * Expected shape of a tenant row from the tenants table.
 */
interface TenantRow {
  id: string;
  subdomain: string;
  dbType: 'SHARED' | 'DEDICATED';
  status: string;
}

/**
 * Expected shape of a tenant database config row.
 */
interface TenantDatabaseConfigRow {
  tenantId: string;
  dbSchema: string | null;
  dbName: string | null;
  dbHost: string | null;
  dbPort: number | null;
  dbUsername: string | null;
  dbPassword: string | null;
  dbSslMode: string | null;
  connectionPoolSize: number | null;
}

/**
 * Service responsible for querying the primary database to resolve tenant configurations
 *
 * This service:
 * - Connects to the primary database (tenant registry)
 * - Queries tenant metadata (database location, credentials, etc.)
 * - Caches tenant configs in memory to reduce database load
 * - Only used in GATEWAY MODE (microservices receive tenant config from messages)
 *
 * @example
 * // In API Gateway
 * const config = await primaryDatabase.getTenantConfig('acme');
 * // Returns: { id, slug, type, databaseHost, databaseName, ... }
 */
@Injectable()
export class PrimaryDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrimaryDatabaseService.name);

  /** PostgreSQL connection pool */
  private pool: Pool | null = null;

  /** Drizzle database instance */
  private db: TypedDrizzleClient | null = null;

  /** In-memory cache: Map<tenantIdentifier, TenantConfig> */
  private readonly tenantConfigCache = new Map<string, TenantInfo>();

  /** Cache TTL in milliseconds */
  private readonly cacheTTL: number;

  constructor(
    @Inject(DATABASE_MODULE_OPTIONS)
    private readonly options: DatabaseModuleOptions,
  ) {
    this.cacheTTL = options.connectionCacheTTL || 300000; // 5 minutes default
  }

  async onModuleInit() {
    // Only initialize if we have primary database config (gateway mode)
    if (this.options.primaryDb) {
      await this.initializeDrizzleClient();
    }
  }

  /**
   * Initialize connection to primary database using Drizzle
   */
  private async initializeDrizzleClient(): Promise<void> {
    try {
      const databaseUrl = this.buildPrimaryDbUrl();

      this.pool = new Pool({
        connectionString: databaseUrl,
        max: this.options.maxConnections || 10,
      });

      // Initialize Drizzle with the schema provided (v2 API)
      // Relations must be passed separately for db.query to work
      this.logger.debug(
        `Schema keys passed to drizzle: [${Object.keys(this.options.drizzleSchema || {}).join(', ')}]`,
      );
      this.logger.debug(
        `Relations keys passed to drizzle: [${Object.keys(this.options.drizzleRelations || {}).join(', ')}]`,
      );
      this.db = drizzle({
        client: this.pool,
        schema: this.options.drizzleSchema,
        relations: this.options.drizzleRelations,
      }) as TypedDrizzleClient;
      this.logger.debug(
        `Drizzle query keys after init: [${Object.keys(this.db.query || {}).join(', ')}]`,
      );

      // Test connection
      await this.pool.query('SELECT 1');
      this.logger.log('Connected to primary database (tenant registry)');
    } catch (error) {
      this.logger.error('Failed to connect to primary database', error);
      throw new InternalServerErrorException(
        'Failed to initialize tenant registry',
      );
    }
  }

  /**
   * Build connection URL from primary database properties
   */
  private buildPrimaryDbUrl(): string {
    if (!this.options.primaryDb) {
      throw new Error('Primary database configuration not provided');
    }

    const {
      host,
      port = 5432,
      username,
      password,
      database,
      schema = 'public',
      sslMode = 'require',
    } = this.options.primaryDb;

    // Build base URL
    let url = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

    // Add query parameters
    const params = new URLSearchParams();
    if (schema) {
      params.set('schema', schema);
    }
    params.set('sslmode', sslMode);

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    this.logger.debug(`Primary DB connection URL: ${this.maskPassword(url)}`);

    return url;
  }

  /**
   * Mask password in connection URL for logging
   */
  private maskPassword(url: string): string {
    return url.replace(/:([^@]+)@/, ':****@');
  }

  /**
   * Get tenant configuration by identifier (ID or subdomain)
   *
   * @param tenantIdentifier Tenant ID or subdomain
   * @returns Tenant configuration or null if not found
   */
  async getTenantInfo(tenantIdentifier: string): Promise<TenantInfo | null> {
    // Check cache first
    const cached = this.tenantConfigCache.get(tenantIdentifier);
    if (cached) {
      this.logger.debug(`Cache hit for tenant: ${tenantIdentifier}`);
      return cached;
    }

    // Query primary database
    try {
      if (!this.db) {
        throw new Error('Primary database client not initialized');
      }

      this.logger.debug(
        `Querying primary database for tenant: ${tenantIdentifier}`,
      );

      // Get table references from schema
      // Cast to TenantSchemaRequirement - consumer must provide these tables
      const schema = this.options.drizzleSchema as unknown as TenantSchemaRequirement;
      const { tenants, tenantDatabaseConfigs } = schema;

      // Query with left join to get tenant and its database config
      const result = await this.db
        .select()
        .from(tenants)
        .leftJoin(
          tenantDatabaseConfigs,
          eq(tenants.id, tenantDatabaseConfigs.tenantId),
        )
        .where(
          or(
            eq(tenants.id, tenantIdentifier),
            eq(tenants.subdomain, tenantIdentifier),
          ),
        )
        .limit(1);

      if (!result.length) {
        this.logger.warn(`Tenant not found: ${tenantIdentifier}`);
        return null;
      }

      // Cast row to access joined table results using typed interfaces
      const row = result[0] as unknown as TenantJoinResultRow;
      const tenant = row.tenants;
      const config = row.tenant_database_configs;

      // Check if tenant is active
      if (tenant.status !== 'ACTIVE') {
        this.logger.warn(`Tenant not active: ${tenantIdentifier}`);
        return null;
      }

      // Build info object - map from separated tables
      const info: TenantInfo = {
        id: tenant.id,
        subdomain: tenant.subdomain,
        type: tenant.dbType,
        status: tenant.status,
        // For SHARED tenants: schema name
        schemaName: config?.dbSchema || undefined,
        // For DEDICATED tenants: database configuration from TenantDatabaseConfig table
        databaseName: config?.dbName || undefined,
        databaseHost: config?.dbHost || undefined,
        databasePort: config?.dbPort || undefined,
        databaseUsername: config?.dbUsername
          ? this.decrypt(config.dbUsername)
          : undefined,
        databasePassword: config?.dbPassword
          ? this.decrypt(config.dbPassword)
          : undefined,
        databaseSslMode: config?.dbSslMode || undefined,
        connectionPoolSize: config?.connectionPoolSize || undefined,
      };

      // Cache by both ID and subdomain
      this.cacheInfo(info);

      return info;
    } catch (error) {
      this.logger.error(
        `Failed to fetch tenant info: ${tenantIdentifier}`,
        error,
      );
      throw new InternalServerErrorException('Failed to resolve tenant');
    }
  }

  /**
   * Cache tenant information with TTL
   */
  private cacheInfo(info: TenantInfo): void {
    this.tenantConfigCache.set(info.id, info);
    this.tenantConfigCache.set(info.subdomain, info);

    // Set expiration
    setTimeout(() => {
      this.tenantConfigCache.delete(info.id);
      this.tenantConfigCache.delete(info.subdomain);
      this.logger.debug(`Cache expired for tenant: ${info.subdomain}`);
    }, this.cacheTTL);
  }

  /**
   * Clear cached tenant information
   *
   * Useful when tenant settings are updated and cache needs to be invalidated
   *
   * @param tenantIdentifier Tenant ID or subdomain
   */
  clearTenantCache(tenantIdentifier: string): void {
    const config = this.tenantConfigCache.get(tenantIdentifier);
    if (config) {
      this.tenantConfigCache.delete(config.id);
      this.tenantConfigCache.delete(config.subdomain);
      this.logger.log(`Cleared cache for tenant: ${tenantIdentifier}`);
    }
  }

  /**
   * Clear all cached tenant configurations
   */
  clearAllCaches(): void {
    const size = this.tenantConfigCache.size;
    this.tenantConfigCache.clear();
    this.logger.log(`Cleared ${size} cached tenant configs`);
  }

  /**
   * Get the Drizzle database instance for the primary database.
   * This is a synchronous property that returns the initialized Drizzle client.
   *
   * @returns Primary database Drizzle instance
   * @throws Error if primary database client is not initialized
   */
  get drizzleClient(): TypedDrizzleClient {
    if (!this.db) {
      throw new Error('Primary database client not initialized');
    }
    return this.db;
  }

  /**
   * Get the Drizzle schema
   */
  get schema(): typeof this.options.drizzleSchema {
    return this.options.drizzleSchema;
  }

  /**
   * Decrypt database credentials
   *
   * Override this method to implement your encryption strategy
   *
   * @param encrypted Encrypted value
   * @returns Decrypted value
   */
  private decrypt(encrypted: string): string {
    // TODO: Implement actual decryption using this.options.encryptionKey
    // For now, return as-is (assumes unencrypted or encryption happens elsewhere)
    return encrypted;
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Disconnected from primary database');
    }
  }
}

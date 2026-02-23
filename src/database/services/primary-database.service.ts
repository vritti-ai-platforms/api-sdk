import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions, TenantInfo } from '../interfaces';
import type { TypedDrizzleClient } from '../schema.registry';

interface TenantSchemaRequirement {
  tenants: PgTable & { id: PgColumn; subdomain: PgColumn; dbType: PgColumn; status: PgColumn };
  tenantDatabaseConfigs: PgTable & {
    tenantId: PgColumn;
    dbSchema: PgColumn;
    dbName: PgColumn;
    dbHost: PgColumn;
    dbPort: PgColumn;
    dbUsername: PgColumn;
    dbPassword: PgColumn;
    dbSslMode: PgColumn;
    connectionPoolSize: PgColumn;
  };
}

interface TenantJoinResultRow {
  tenants: TenantRow;
  tenant_database_configs: TenantDatabaseConfigRow | null;
}

interface TenantRow {
  id: string;
  subdomain: string;
  dbType: 'SHARED' | 'DEDICATED';
  status: string;
}

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

@Injectable()
export class PrimaryDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrimaryDatabaseService.name);

  private pool: Pool | null = null;
  private db: TypedDrizzleClient | null = null;
  private readonly tenantConfigCache = new Map<string, TenantInfo>();
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

  // Initializes connection to primary database using Drizzle
  private async initializeDrizzleClient(): Promise<void> {
    try {
      const databaseUrl = this.buildPrimaryDbUrl();

      this.pool = new Pool({
        connectionString: databaseUrl,
        max: this.options.maxConnections || 10,
      });

      // Initialize Drizzle with the schema provided (v2 API)
      // Relations must be passed separately for db.query to work
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

      // Test connection
      await this.pool.query('SELECT 1');
      this.logger.log('Connected to primary database (tenant registry)');
    } catch (error) {
      this.logger.error('Failed to connect to primary database', error);
      throw new InternalServerErrorException('Failed to initialize tenant registry');
    }
  }

  // Builds the PostgreSQL connection URL from primary database config properties
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

  // Masks password in connection URL for safe logging
  private maskPassword(url: string): string {
    return url.replace(/:([^@]+)@/, ':****@');
  }

  // Retrieves tenant configuration by ID or subdomain, with in-memory caching
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

      this.logger.debug(`Querying primary database for tenant: ${tenantIdentifier}`);

      // Get table references from schema
      // Cast to TenantSchemaRequirement - consumer must provide these tables
      const schema = this.options.drizzleSchema as unknown as TenantSchemaRequirement;
      const { tenants, tenantDatabaseConfigs } = schema;

      // Query with left join to get tenant and its database config
      const result = await this.db
        .select()
        .from(tenants)
        .leftJoin(tenantDatabaseConfigs, eq(tenants.id, tenantDatabaseConfigs.tenantId))
        .where(or(eq(tenants.id, tenantIdentifier), eq(tenants.subdomain, tenantIdentifier)))
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
        databaseUsername: config?.dbUsername ? this.decrypt(config.dbUsername) : undefined,
        databasePassword: config?.dbPassword ? this.decrypt(config.dbPassword) : undefined,
        databaseSslMode: config?.dbSslMode || undefined,
        connectionPoolSize: config?.connectionPoolSize || undefined,
      };

      // Cache by both ID and subdomain
      this.cacheInfo(info);

      return info;
    } catch (error) {
      this.logger.error(`Failed to fetch tenant info: ${tenantIdentifier}`, error);
      throw new InternalServerErrorException('Failed to resolve tenant');
    }
  }

  // Caches tenant info by both ID and subdomain with TTL expiration
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

  // Clears cached tenant info for the given ID or subdomain
  clearTenantCache(tenantIdentifier: string): void {
    const config = this.tenantConfigCache.get(tenantIdentifier);
    if (config) {
      this.tenantConfigCache.delete(config.id);
      this.tenantConfigCache.delete(config.subdomain);
      this.logger.log(`Cleared cache for tenant: ${tenantIdentifier}`);
    }
  }

  // Clears all cached tenant configurations
  clearAllCaches(): void {
    const size = this.tenantConfigCache.size;
    this.tenantConfigCache.clear();
    this.logger.log(`Cleared ${size} cached tenant configs`);
  }

  // Returns the initialized Drizzle client, throwing if not yet initialized
  get drizzleClient(): TypedDrizzleClient {
    if (!this.db) {
      throw new Error('Primary database client not initialized');
    }
    return this.db;
  }

  // Returns the Drizzle schema passed in module options
  get schema(): typeof this.options.drizzleSchema {
    return this.options.drizzleSchema;
  }

  // Decrypts a database credential value (placeholder for actual decryption)
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

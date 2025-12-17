import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions, TenantInfo } from '../interfaces';

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

  /** Primary database client for querying tenant registry */
  private primaryDbClient: any;

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
      await this.initializePrimaryDbClient();
    }
  }

  /**
   * Initialize connection to primary database
   */
  private async initializePrimaryDbClient(): Promise<void> {
    try {
      const PrismaClient = this.options.prismaClientConstructor;
      const PrismaAdapter = this.options.prismaAdapterConstructor;

      // Build connection URL from individual properties
      const databaseUrl = this.buildPrimaryDbUrl();
      const schema = this.options.primaryDb.schema || 'public';

      // Prisma 7: Use driver adapter pattern instead of datasources
      // Schema must be passed as second argument (not in URL) for adapter-pg
      const adapter = new PrismaAdapter(
        { connectionString: databaseUrl },
        { schema }
      );

      this.primaryDbClient = new PrismaClient({ adapter });

      await this.primaryDbClient.$connect();
      this.logger.log('Connected to primary database (tenant registry)');
    } catch (error) {
      this.logger.error('Failed to connect to primary database', error);
      throw new InternalServerErrorException('Failed to initialize tenant registry');
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
    let url = `postgresql://${username}:${password}@${host}:${port}/${database}`;

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
   * Get tenant configuration by identifier (ID or slug)
   *
   * @param tenantIdentifier Tenant ID or slug
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
      if (!this.primaryDbClient) {
        throw new Error('Primary database client not initialized');
      }

      this.logger.debug(`Querying primary database for tenant: ${tenantIdentifier}`);

      const tenant = await this.primaryDbClient.tenant.findFirst({
        where: {
          OR: [{ id: tenantIdentifier }, { subdomain: tenantIdentifier }],
          status: 'ACTIVE',
        },
        include: {
          databaseConfig: true,
        },
      });

      if (!tenant) {
        this.logger.warn(`Tenant not found: ${tenantIdentifier}`);
        return null;
      }

      // Build info object - map from separated tables
      const info: TenantInfo = {
        id: tenant.id,
        subdomain: tenant.subdomain,
        type: tenant.dbType,
        status: tenant.status,
        // For SHARED tenants: schema name
        schemaName: tenant.databaseConfig?.dbSchema || undefined,
        // For DEDICATED tenants: database configuration from TenantDatabaseConfig table
        databaseName: tenant.databaseConfig?.dbName || undefined,
        databaseHost: tenant.databaseConfig?.dbHost || undefined,
        databasePort: tenant.databaseConfig?.dbPort || undefined,
        databaseUsername: tenant.databaseConfig?.dbUsername
          ? this.decrypt(tenant.databaseConfig.dbUsername)
          : undefined,
        databasePassword: tenant.databaseConfig?.dbPassword
          ? this.decrypt(tenant.databaseConfig.dbPassword)
          : undefined,
        databaseSslMode: tenant.databaseConfig?.dbSslMode || undefined,
        connectionPoolSize: tenant.databaseConfig?.connectionPoolSize || undefined,
      };

      // Cache by both ID and slug
      this.cacheInfo(info);

      return info;
    } catch (error) {
      this.logger.error(`Failed to fetch tenant info: ${tenantIdentifier}`, error);
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
   * @param tenantIdentifier Tenant ID or slug
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
   * Get the Prisma client for the primary database.
   * This is a synchronous property that returns the initialized Prisma client.
   *
   * @returns Primary database client instance
   * @throws Error if primary database client is not initialized
   */
  get prismaClient(): any {
    if (!this.primaryDbClient) {
      throw new Error('Primary database client not initialized');
    }
    return this.primaryDbClient;
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
    if (this.primaryDbClient) {
      await this.primaryDbClient.$disconnect();
      this.logger.log('Disconnected from primary database');
    }
  }
}

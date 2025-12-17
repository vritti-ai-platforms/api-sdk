import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions, TenantInfo } from '../interfaces';
import { TenantContextService } from './tenant-context.service';

/**
 * Service responsible for managing tenant-scoped database connections
 *
 * This service:
 * - Maintains a connection pool (Map<cacheKey, DbClient>)
 * - Creates new connections dynamically based on tenant context
 * - Reuses existing connections for the same tenant
 * - Supports both cloud schemas and enterprise databases
 * - Automatically cleans up idle connections
 *
 * @example
 * // In a controller or service
 * const dbClient = await this.tenantDatabase.getDbClient<PrismaClient>();
 * const users = await dbClient.user.findMany();
 */
@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatabaseService.name);

  /** Connection pool: Map<cacheKey, DbClient> */
  private readonly clients = new Map<string, any>();

  /** Track last usage time for idle connection cleanup */
  private readonly clientLastUsed = new Map<string, number>();

  /** Cleanup interval timer */
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @Inject(DATABASE_MODULE_OPTIONS)
    private readonly options: DatabaseModuleOptions,
    private readonly tenantContext: TenantContextService,
  ) {
    this.startConnectionCleaner();
  }

  /**
   * Get the Prisma client for the current tenant's database.
   * This returns the tenant-scoped database client.
   *
   * @returns Tenant-scoped database client instance
   * @throws UnauthorizedException if tenant context not set
   * @throws InternalServerErrorException if connection fails
   */
  get prismaClient(): any {
    return this.getDbClient();
  }

  /**
   * Get tenant-scoped database client for the current request/message
   *
   * This method:
   * 1. Gets tenant info from TenantContextService
   * 2. Builds a connection URL based on tenant type
   * 3. Returns cached client if exists, otherwise creates new one
   *
   * @returns Promise<Database client instance>
   * @throws UnauthorizedException if tenant context not set
   * @throws InternalServerErrorException if connection fails
   *
   * @example
   * const dbClient = await tenantDatabase.getDbClient<PrismaClient>();
   * const users = await dbClient.user.findMany();
   */
  private async getDbClient<T = any>(): Promise<T> {
    const tenant = this.tenantContext.getTenant();

    const cacheKey = this.buildCacheKey(tenant);

    // Check if connection already exists
    if (this.clients.has(cacheKey)) {
      this.clientLastUsed.set(cacheKey, Date.now());
      this.logger.debug(`Reusing cached connection: ${cacheKey}`);
      return this.clients.get(cacheKey) as T;
    }

    // Create new connection
    this.logger.log(`Creating new database connection: ${cacheKey}`);
    const client = await this.createDbClient(tenant);
    this.clients.set(cacheKey, client);
    this.clientLastUsed.set(cacheKey, Date.now());

    return client as T;
  }

  /**
   * Create a new database client for the given tenant
   */
  private async createDbClient(tenant: TenantInfo): Promise<any> {
    try {
      // Build tenant-specific database URL
      const databaseUrl = this.buildTenantDbUrl(tenant);

      // Load Prisma client and adapter constructors
      const PrismaClient = await this.options.prismaClientConstructor;
      const PrismaAdapter = this.options.prismaAdapterConstructor;

      // Prisma 7: Use driver adapter pattern instead of datasources
      const adapter = new PrismaAdapter({ connectionString: databaseUrl });

      // Create new instance with tenant-specific connection
      const client = new PrismaClient({ adapter });

      await client.$connect();
      this.logger.log(`Connected to database for tenant: ${tenant.subdomain}`);

      return client;
    } catch (error) {
      this.logger.error(
        `Failed to create database connection for tenant: ${tenant.subdomain}`,
        error,
      );
      throw new InternalServerErrorException('Failed to connect to tenant database');
    }
  }

  /**
   * Build connection URL for enterprise tenant (dedicated database)
   */
  private buildTenantDbUrl(tenant: TenantInfo): string {
    const {
      databaseHost,
      databasePort,
      databaseName,
      databaseUsername,
      databasePassword,
      databaseSslMode,
    } = tenant;

    if (!databaseHost || !databaseName || !databaseUsername) {
      throw new Error(`Enterprise tenant ${tenant.subdomain} missing database configuration`);
    }

    const port = databasePort || 5432;
    const sslMode = databaseSslMode || 'require';
    const connectionUrl = `postgresql://${databaseUsername}:${databasePassword}@${databaseHost}:${port}/${databaseName}?sslmode=${sslMode}`;

    this.logger.debug(`Enterprise connection URL: ${this.maskPassword(connectionUrl)}`);

    return connectionUrl;
  }

  /**
   * Build cache key for connection pooling
   */
  private buildCacheKey(tenant: TenantInfo): string {
    return `${tenant.type}:${tenant.databaseName}@${tenant.databaseHost}`;
  }

  /**
   * Start periodic cleanup of idle connections
   */
  private startConnectionCleaner(): void {
    const interval = this.options.connectionCacheTTL || 300000; // 5 minutes

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, interval);

    this.logger.log(`Connection cleanup scheduled every ${interval / 1000} seconds`);
  }

  /**
   * Clean up idle connections that haven't been used recently
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const maxIdle = this.options.connectionCacheTTL || 300000;

    let cleaned = 0;

    for (const [key, lastUsed] of this.clientLastUsed.entries()) {
      if (now - lastUsed > maxIdle) {
        const client = this.clients.get(key);
        if (client) {
          client
            .$disconnect()
            .then(() => {
              this.logger.debug(`Cleaned up idle connection: ${key}`);
            })
            .catch((error: any) => {
              this.logger.error(`Error disconnecting idle client: ${key}`, error);
            });

          this.clients.delete(key);
          this.clientLastUsed.delete(key);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} idle connections`);
    }
  }

  /**
   * Get current connection pool statistics
   */
  getPoolStats(): {
    activeConnections: number;
    tenants: string[];
  } {
    return {
      activeConnections: this.clients.size,
      tenants: Array.from(this.clients.keys()),
    };
  }

  /**
   * Mask password in connection URL for logging
   */
  private maskPassword(url: string): string {
    return url.replace(/:([^@]+)@/, ':****@');
  }

  async onModuleDestroy() {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Disconnect all clients
    this.logger.log(`Disconnecting ${this.clients.size} database connections`);

    const disconnectPromises = Array.from(this.clients.entries()).map(async ([key, client]) => {
      try {
        await client.$disconnect();
        this.logger.debug(`Disconnected: ${key}`);
      } catch (error) {
        this.logger.error(`Error disconnecting client: ${key}`, error);
      }
    });

    await Promise.all(disconnectPromises);
    this.logger.log('All database connections closed');
  }
}

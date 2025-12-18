import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions, TenantInfo } from '../interfaces';
import { TenantContextService } from './tenant-context.service';
import type { TypedDrizzleClient } from '../schema.registry';

/**
 * Tenant connection wrapper containing both pool and Drizzle instance
 */
interface TenantConnection {
  pool: Pool;
  db: TypedDrizzleClient;
}

/**
 * Service responsible for managing tenant-scoped database connections
 *
 * This service:
 * - Maintains a connection pool (Map<cacheKey, TenantConnection>)
 * - Creates new connections dynamically based on tenant context
 * - Reuses existing connections for the same tenant
 * - Supports both cloud schemas and enterprise databases
 * - Automatically cleans up idle connections
 *
 * @example
 * // In a controller or service
 * const db = this.tenantDatabase.drizzleClient;
 * const users = await db.select().from(usersTable);
 */
@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatabaseService.name);

  /** Connection pool: Map<cacheKey, TenantConnection> */
  private readonly clients = new Map<string, TenantConnection>();

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
   * Get the Drizzle client for the current tenant's database.
   * This returns the tenant-scoped database client.
   *
   * @returns Tenant-scoped Drizzle database instance
   * @throws UnauthorizedException if tenant context not set
   * @throws InternalServerErrorException if connection fails
   */
  get drizzleClient(): TypedDrizzleClient {
    return this.getDbClient();
  }

  /**
   * Get the Drizzle schema
   */
  get schema(): Record<string, unknown> {
    return this.options.drizzleSchema;
  }

  /**
   * Get tenant-scoped database client for the current request/message
   *
   * This method:
   * 1. Gets tenant info from TenantContextService
   * 2. Builds a connection URL based on tenant type
   * 3. Returns cached client if exists, otherwise creates new one
   *
   * @returns Drizzle database instance
   * @throws UnauthorizedException if tenant context not set
   * @throws InternalServerErrorException if connection fails
   */
  private getDbClient(): TypedDrizzleClient {
    const tenant = this.tenantContext.getTenant();
    const cacheKey = this.buildCacheKey(tenant);

    // Check if connection already exists
    const existing = this.clients.get(cacheKey);
    if (existing) {
      this.clientLastUsed.set(cacheKey, Date.now());
      this.logger.debug(`Reusing cached connection: ${cacheKey}`);
      return existing.db;
    }

    // Create new connection synchronously
    this.logger.log(`Creating new database connection: ${cacheKey}`);
    const connection = this.createDbClientSync(tenant);
    this.clients.set(cacheKey, connection);
    this.clientLastUsed.set(cacheKey, Date.now());

    return connection.db;
  }

  /**
   * Create a new database client for the given tenant (synchronous)
   */
  private createDbClientSync(tenant: TenantInfo): TenantConnection {
    try {
      // Build tenant-specific database URL
      const databaseUrl = this.buildTenantDbUrl(tenant);

      // Create PostgreSQL pool
      const pool = new Pool({
        connectionString: databaseUrl,
        max: tenant.connectionPoolSize || this.options.maxConnections || 10,
      });

      // Initialize Drizzle with the schema (v2 API)
      const db = drizzle({
        client: pool,
        schema: this.options.drizzleSchema,
      }) as TypedDrizzleClient;

      this.logger.log(`Connected to database for tenant: ${tenant.subdomain}`);

      return { pool, db };
    } catch (error) {
      this.logger.error(
        `Failed to create database connection for tenant: ${tenant.subdomain}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to connect to tenant database',
      );
    }
  }

  /**
   * Build connection URL for tenant (dedicated database)
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
      throw new Error(
        `Tenant ${tenant.subdomain} missing database configuration`,
      );
    }

    const port = databasePort || 5432;
    const sslMode = databaseSslMode || 'require';
    const connectionUrl = `postgresql://${databaseUsername}:${encodeURIComponent(databasePassword || '')}@${databaseHost}:${port}/${databaseName}?sslmode=${sslMode}`;

    this.logger.debug(
      `Tenant connection URL: ${this.maskPassword(connectionUrl)}`,
    );

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

    this.logger.log(
      `Connection cleanup scheduled every ${interval / 1000} seconds`,
    );
  }

  /**
   * Clean up idle connections that haven't been used recently
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const maxIdle = this.options.connectionCacheTTL || 300000;

    let cleaned = 0;

    for (const [key, lastUsed] of this.clientLastUsed.entries()) {
      if (now - lastUsed > maxIdle) {
        const connection = this.clients.get(key);
        if (connection) {
          try {
            await connection.pool.end();
            this.logger.debug(`Cleaned up idle connection: ${key}`);
          } catch (error) {
            this.logger.error(`Error disconnecting idle client: ${key}`, error);
          }

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

    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([key, connection]) => {
        try {
          await connection.pool.end();
          this.logger.debug(`Disconnected: ${key}`);
        } catch (error) {
          this.logger.error(`Error disconnecting client: ${key}`, error);
        }
      },
    );

    await Promise.all(disconnectPromises);
    this.logger.log('All database connections closed');
  }
}

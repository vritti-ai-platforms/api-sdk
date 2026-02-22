import { Inject, Injectable, InternalServerErrorException, Logger, type OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions, TenantInfo } from '../interfaces';
import type { TypedDrizzleClient } from '../schema.registry';
import { TenantContextService } from './tenant-context.service';

interface TenantConnection {
  pool: Pool;
  db: TypedDrizzleClient;
}

@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatabaseService.name);

  private readonly clients = new Map<string, TenantConnection>();
  private readonly clientLastUsed = new Map<string, number>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @Inject(DATABASE_MODULE_OPTIONS)
    private readonly options: DatabaseModuleOptions,
    private readonly tenantContext: TenantContextService,
  ) {
    this.startConnectionCleaner();
  }

  // Returns the Drizzle client scoped to the current tenant's database
  get drizzleClient(): TypedDrizzleClient {
    return this.getDbClient();
  }

  // Returns the Drizzle schema passed in module options
  get schema(): Record<string, unknown> {
    return this.options.drizzleSchema;
  }

  // Returns a cached or new Drizzle client for the current tenant context
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

  // Creates a new pool and Drizzle client for the given tenant
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
      this.logger.error(`Failed to create database connection for tenant: ${tenant.subdomain}`, error);
      throw new InternalServerErrorException('Failed to connect to tenant database');
    }
  }

  // Builds the PostgreSQL connection URL for a dedicated tenant database
  private buildTenantDbUrl(tenant: TenantInfo): string {
    const { databaseHost, databasePort, databaseName, databaseUsername, databasePassword, databaseSslMode } = tenant;

    if (!databaseHost || !databaseName || !databaseUsername) {
      throw new Error(`Tenant ${tenant.subdomain} missing database configuration`);
    }

    const port = databasePort || 5432;
    const sslMode = databaseSslMode || 'require';
    const connectionUrl = `postgresql://${databaseUsername}:${encodeURIComponent(databasePassword || '')}@${databaseHost}:${port}/${databaseName}?sslmode=${sslMode}`;

    this.logger.debug(`Tenant connection URL: ${this.maskPassword(connectionUrl)}`);

    return connectionUrl;
  }

  // Builds a cache key for connection pooling from tenant database coordinates
  private buildCacheKey(tenant: TenantInfo): string {
    return `${tenant.type}:${tenant.databaseName}@${tenant.databaseHost}`;
  }

  // Starts a periodic interval to close idle database connections
  private startConnectionCleaner(): void {
    const interval = this.options.connectionCacheTTL || 300000; // 5 minutes

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, interval);

    this.logger.log(`Connection cleanup scheduled every ${interval / 1000} seconds`);
  }

  // Closes and removes connections that have been idle beyond the TTL
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

  // Returns the current number of active pooled connections and their tenant keys
  getPoolStats(): {
    activeConnections: number;
    tenants: string[];
  } {
    return {
      activeConnections: this.clients.size,
      tenants: Array.from(this.clients.keys()),
    };
  }

  // Masks password in connection URL for safe logging
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

    const disconnectPromises = Array.from(this.clients.entries()).map(async ([key, connection]) => {
      try {
        await connection.pool.end();
        this.logger.debug(`Disconnected: ${key}`);
      } catch (error) {
        this.logger.error(`Error disconnecting client: ${key}`, error);
      }
    });

    await Promise.all(disconnectPromises);
    this.logger.log('All database connections closed');
  }
}

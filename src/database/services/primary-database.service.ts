import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DATABASE_MODULE_OPTIONS } from '../constants';
import type { DatabaseModuleOptions } from '../interfaces';
import type { TypedDrizzleClient } from '../schema.registry';

@Injectable()
export class PrimaryDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrimaryDatabaseService.name);

  private pool: Pool | null = null;
  private db: TypedDrizzleClient | null = null;

  constructor(
    @Inject(DATABASE_MODULE_OPTIONS)
    private readonly options: DatabaseModuleOptions,
  ) {}

  async onModuleInit() {
    if (this.options.primaryDb) {
      await this.initializeDrizzleClient();
    }
  }

  // Initializes connection to primary database using Drizzle
  private async initializeDrizzleClient(): Promise<void> {
    try {
      const { host, port = 5432, username, password, database, schema, sslMode = 'require' } = this.options.primaryDb;

      this.pool = new Pool({
        host,
        port,
        user: username,
        password,
        database,
        max: this.options.maxConnections || 10,
        ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode !== 'no-verify' },
        ...(schema && { options: `-csearch_path=${schema}` }),
      });

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

      await this.pool.query('SELECT 1');
      this.logger.log(`Connected to primary database (schema: ${schema ?? 'public'})`);
    } catch (error) {
      this.logger.error('Failed to connect to primary database', error);
      throw new InternalServerErrorException('Failed to initialize database connection');
    }
  }

  // Returns the initialized Drizzle client
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

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Disconnected from primary database');
    }
  }
}

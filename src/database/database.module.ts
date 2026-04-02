import { type DynamicModule, Global, type InjectionToken, Module, type Provider } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestModule } from '../request/request.module';
import { DATABASE_MODULE_OPTIONS } from './constants';
import type { DatabaseModuleOptions } from './interfaces';
import { PrimaryDatabaseService } from './services/primary-database.service';

@Global()
@Module({})
export class DatabaseModule {
  // Configures the database module with a single primary connection
  static forServer(options: {
    useFactory: (...args: unknown[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
    inject?: InjectionToken[];
  }): DynamicModule {
    const asyncProvider: Provider = {
      provide: DATABASE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    return {
      module: DatabaseModule,
      imports: [RequestModule],
      providers: [
        { provide: Reflector, useClass: Reflector },
        asyncProvider,
        PrimaryDatabaseService,
      ],
      exports: [PrimaryDatabaseService, asyncProvider],
    };
  }
}

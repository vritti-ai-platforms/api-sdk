import { type DynamicModule, Global, type InjectionToken, Module, type Provider } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestModule } from '../request/request.module';
import { DATABASE_MODULE_OPTIONS } from './constants';

import type { DatabaseModuleOptions } from './interfaces';
import { PrimaryDatabaseService } from './services/primary-database.service';
import { TenantContextService } from './services/tenant-context.service';
import { TenantDatabaseService } from './services/tenant-database.service';

@Global()
@Module({})
export class DatabaseModule {
  // Configures the module for gateway/HTTP mode with TenantContextInterceptor
  static forServer(options: {
    useFactory: (...args: unknown[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
    inject?: InjectionToken[];
  }): DynamicModule {
    return DatabaseModule.createDynamicModule(options, 'server');
  }

  // Configures the module for microservice mode with MessageTenantContextInterceptor
  static forMicroservice(options: {
    useFactory: (...args: unknown[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
    inject?: InjectionToken[];
  }): DynamicModule {
    return DatabaseModule.createDynamicModule(options, 'microservice');
  }

  // Creates the dynamic module configuration with the appropriate interceptor for the given mode
  private static createDynamicModule(
    options: {
      useFactory: (...args: unknown[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
      inject?: InjectionToken[];
    },
    mode: 'server' | 'microservice',
  ): DynamicModule {
    const asyncProvider: Provider = {
      provide: DATABASE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const providers: Provider[] = [
      // Required for external packages - NestJS global Reflector not available
      {
        provide: Reflector,
        useClass: Reflector,
      },
      asyncProvider,
      TenantContextService,
      PrimaryDatabaseService,
      TenantDatabaseService,
    ];

    // Temporarily disabled — tenant database routing not yet in use
    // if (mode === 'server') {
    //   providers.push({
    //     provide: APP_INTERCEPTOR,
    //     useClass: TenantContextInterceptor,
    //   });
    // } else {
    //   providers.push({
    //     provide: APP_INTERCEPTOR,
    //     useClass: MessageTenantContextInterceptor,
    //   });
    // }

    return {
      module: DatabaseModule,
      imports: [RequestModule],
      providers,
      exports: [TenantDatabaseService, TenantContextService, PrimaryDatabaseService, asyncProvider],
    };
  }
}

import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestModule } from '../request/request.module';
import { DATABASE_MODULE_OPTIONS } from './constants';
import { MessageTenantContextInterceptor } from './interceptors/message-tenant-context.interceptor';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';

import type { DatabaseModuleOptions } from './interfaces';
import { PrimaryDatabaseService } from './services/primary-database.service';
import { TenantContextService } from './services/tenant-context.service';
import { TenantDatabaseService } from './services/tenant-database.service';

/**
 * Dynamic module for multi-tenant database management
 *
 * This module provides:
 * - Tenant context management (request-scoped)
 * - Database connection pooling
 * - Dynamic schema/cluster routing
 * - Support for both gateway and microservice modes
 *
 * ## Gateway Mode (API Gateway)
 * - Use DatabaseModule.forServer() method
 * - Automatically extracts tenant from subdomain, falls back to x-tenant-id header
 * - Provide primaryDb configuration and prismaClientConstructor
 * - Automatically queries primary DB for tenant config
 * - Automatically registers TenantContextInterceptor globally
 * - No manual interceptor registration needed
 *
 * ## Microservice Mode (RabbitMQ Workers)
 * - Use DatabaseModule.forMicroservice() method
 * - Only provide prismaClientConstructor
 * - Tenant context comes from RabbitMQ messages
 * - Automatically registers MessageTenantContextInterceptor globally
 * - No manual interceptor registration needed
 *
 * @example
 * // Gateway configuration
 * DatabaseModule.forServer({
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     primaryDb: {
 *       host: config.get('PRIMARY_DB_HOST'),
 *       port: config.get('PRIMARY_DB_PORT'),
 *       username: config.get('PRIMARY_DB_USERNAME'),
 *       password: config.get('PRIMARY_DB_PASSWORD'),
 *       database: config.get('PRIMARY_DB_DATABASE'),
 *     },
 *     prismaClientConstructor: PrismaClient,
 *   }),
 * })
 *
 * @example
 * // Microservice configuration
 * DatabaseModule.forMicroservice({
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     prismaClientConstructor: PrismaClient,
 *   }),
 * })
 */
@Global()
@Module({})
export class DatabaseModule {
  /**
   * Configure DatabaseModule for Gateway/HTTP mode (multi-tenant web servers)
   *
   * This mode is for API Gateways that handle HTTP requests:
   * - Automatically registers TenantContextInterceptor
   * - Extracts tenant from subdomain or x-tenant-id header
   * - Queries primary database for tenant configuration
   * - Provides PrimaryDatabaseService for tenant lookup
   *
   * @param options Async configuration options
   * @returns Dynamic module configuration with HTTP interceptor
   *
   * @example
   * DatabaseModule.forServer({
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     primaryDb: {
   *       host: config.get('PRIMARY_DB_HOST'),
   *       port: config.get('PRIMARY_DB_PORT'),
   *       username: config.get('PRIMARY_DB_USERNAME'),
   *       password: config.get('PRIMARY_DB_PASSWORD'),
   *       database: config.get('PRIMARY_DB_DATABASE'),
   *     },
   *     prismaClientConstructor: PrismaClient,
   *   }),
   * })
   */
  static forServer(options: {
    useFactory: (...args: any[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return DatabaseModule.createDynamicModule(options, 'server');
  }

  /**
   * Configure DatabaseModule for Microservice/Messaging mode (RabbitMQ workers)
   *
   * This mode is for microservices that process messages from queues:
   * - Automatically registers MessageTenantContextInterceptor
   * - Extracts tenant from RabbitMQ message patterns
   * - No primary database needed (tenant comes from message context)
   *
   * @param options Async configuration options
   * @returns Dynamic module configuration with message interceptor
   *
   * @example
   * DatabaseModule.forMicroservice({
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     prismaClientConstructor: PrismaClient,
   *   }),
   * })
   */
  static forMicroservice(options: {
    useFactory: (...args: any[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return DatabaseModule.createDynamicModule(options, 'microservice');
  }

  /**
   * Internal helper to create dynamic module with conditional interceptor registration
   *
   * @param options Configuration options
   * @param mode Mode of operation (gateway or microservice)
   * @returns Dynamic module configuration
   */
  private static createDynamicModule(
    options: {
      useFactory: (...args: any[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
      inject?: any[];
    },
    mode: 'server' | 'microservice',
  ): DynamicModule {
    const asyncProvider: Provider = {
      provide: DATABASE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const providers: Provider[] = [asyncProvider, TenantContextService, PrimaryDatabaseService, TenantDatabaseService];

    // Conditionally add interceptor based on mode
    if (mode === 'server') {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TenantContextInterceptor,
      });
    } else {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: MessageTenantContextInterceptor,
      });
    }

    return {
      module: DatabaseModule,
      imports: [RequestModule], // Import RequestModule for gateway interceptor
      providers,
      exports: [TenantDatabaseService, TenantContextService, PrimaryDatabaseService, asyncProvider],
    };
  }
}

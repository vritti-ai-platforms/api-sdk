import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CACHE_MODULE_OPTIONS, CACHE_PROVIDER, LRU_CACHE_OPTIONS } from './constants';
import { type LruCacheOptions, LruCacheProvider } from './providers/lru.provider';
import { RedisCacheProvider } from './providers/redis.provider';

export interface CacheModuleOptions {
  driver?: 'redis' | 'lru';
  lru?: LruCacheOptions;
}

// biome-ignore lint/suspicious/noExplicitAny: NestJS async factory injects/imports are heterogeneous
type AnyList = any[];

export interface CacheModuleAsyncOptions {
  imports?: AnyList;
  inject?: AnyList;
  useFactory: (...args: AnyList) => CacheModuleOptions | Promise<CacheModuleOptions>;
}

// Bare import defaults to the Redis provider (kept for existing consumers).
// Use CacheModule.forRoot({ driver: 'lru' }) to bind CacheService to the in-memory LRU provider instead.
@Module({
  imports: [ConfigModule],
  providers: [
    RedisCacheProvider,
    {
      provide: CACHE_PROVIDER,
      useExisting: RedisCacheProvider,
    },
    CacheService,
  ],
  exports: [RedisCacheProvider, CACHE_PROVIDER, CacheService],
})
export class CacheModule {
  // Selects the backing provider; each import gets its own CacheService bound to the chosen driver
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    if (options.driver === 'lru') {
      return {
        module: CacheModule,
        providers: [
          { provide: LRU_CACHE_OPTIONS, useValue: options.lru ?? {} },
          LruCacheProvider,
          { provide: CACHE_PROVIDER, useExisting: LruCacheProvider },
          CacheService,
        ],
        exports: [LruCacheProvider, CACHE_PROVIDER, CacheService],
      };
    }
    return {
      module: CacheModule,
      imports: [ConfigModule],
      providers: [RedisCacheProvider, { provide: CACHE_PROVIDER, useExisting: RedisCacheProvider }, CacheService],
      exports: [RedisCacheProvider, CACHE_PROVIDER, CacheService],
    };
  }

  // Same driver selection as forRoot, but the options (and thus the driver) resolve via a factory —
  // e.g. useFactory: (config: ConfigService) => ({ driver: config.get('CACHE_DRIVER') ?? 'lru' }).
  // Both providers are declared but RedisCacheProvider connects lazily, so the unused one is inert.
  static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: CACHE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };
    return {
      module: CacheModule,
      imports: [ConfigModule, ...(options.imports ?? [])],
      providers: [
        optionsProvider,
        {
          provide: LRU_CACHE_OPTIONS,
          useFactory: (opts: CacheModuleOptions) => opts.lru ?? {},
          inject: [CACHE_MODULE_OPTIONS],
        },
        LruCacheProvider,
        RedisCacheProvider,
        {
          provide: CACHE_PROVIDER,
          useFactory: (opts: CacheModuleOptions, lru: LruCacheProvider, redis: RedisCacheProvider) =>
            opts.driver === 'redis' ? redis : lru,
          inject: [CACHE_MODULE_OPTIONS, LruCacheProvider, RedisCacheProvider],
        },
        CacheService,
      ],
      exports: [CACHE_PROVIDER, CacheService],
    };
  }
}

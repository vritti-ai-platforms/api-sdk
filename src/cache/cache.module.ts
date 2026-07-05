import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CACHE_PROVIDER, LRU_CACHE_OPTIONS } from './constants';
import { type LruCacheOptions, LruCacheProvider } from './providers/lru.provider';
import { RedisCacheProvider } from './providers/redis.provider';

export interface CacheModuleOptions {
  driver?: 'redis' | 'lru';
  lru?: LruCacheOptions;
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
}

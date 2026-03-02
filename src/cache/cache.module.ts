import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CACHE_PROVIDER } from './constants';
import { RedisCacheProvider } from './providers/redis.provider';

// To add a new provider in the future:
//   1. Create providers/memcached.provider.ts implementing ICacheProvider
//   2. Replace RedisCacheProvider with the new class in useExisting below

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
export class CacheModule {}

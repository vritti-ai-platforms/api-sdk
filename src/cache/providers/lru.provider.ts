import { Inject, Injectable, Optional } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { DEFAULT_LRU_MAX, LRU_CACHE_OPTIONS } from '../constants';
import type { ICacheProvider } from '../interfaces/cache-provider.interface';

export interface LruCacheOptions {
  // Maximum number of entries before least-recently-used ones are evicted
  max?: number;
}

// Escapes a Redis-style glob (only * and ? are special) into an anchored RegExp for key scanning
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

// In-memory cache provider backed by lru-cache — bounded (max entries + LRU eviction) with per-key TTL.
// Single-instance only: not shared across replicas. For multi-instance, use RedisCacheProvider.
@Injectable()
export class LruCacheProvider implements ICacheProvider {
  private readonly cache: LRUCache<string, object>;

  constructor(@Optional() @Inject(LRU_CACHE_OPTIONS) options?: LruCacheOptions) {
    this.cache = new LRUCache<string, object>({ max: options?.max ?? DEFAULT_LRU_MAX });
  }

  // Stores a value with a per-key TTL (wrapped so primitives survive lru-cache's object value type)
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.cache.set(key, { value } as object, { ttl: ttlSeconds * 1000 });
  }

  // Returns the stored value, or null on miss or expiry
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as { value: T } | undefined;
    return entry ? entry.value : null;
  }

  // Deletes one or more keys
  async del(...keys: string[]): Promise<void> {
    for (const key of keys) this.cache.delete(key);
  }

  // Returns all live keys matching a Redis-style glob pattern
  async scanKeys(pattern: string): Promise<string[]> {
    const regex = globToRegExp(pattern);
    return [...this.cache.keys()].filter((key) => regex.test(key));
  }

  // Reports entry count for monitoring utilities
  async getMemoryInfo(): Promise<string> {
    return `entries:${this.cache.size} max:${this.cache.max}`;
  }
}

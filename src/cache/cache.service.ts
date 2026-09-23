import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_PROVIDER } from './constants';
import type { ICacheProvider } from './interfaces/cache-provider.interface';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_PROVIDER) private readonly provider: ICacheProvider) {}

  // Stores a value with mandatory TTL — errors are logged and swallowed so DB writes still succeed
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.provider.set(key, value, ttlSeconds);
    } catch (err) {
      this.logger.error(`Cache set failed for key "${key}"`, err);
    }
  }

  // Returns cached value or null on miss or any Redis error — callers fall back to DB
  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.provider.get<T>(key);
    } catch (err) {
      this.logger.error(`Cache get failed for key "${key}"`, err);
      return null;
    }
  }

  // Reads many keys at once. On any error every entry reads as a miss, so callers fall back to the
  // database exactly as they would for a cold cache.
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      return await this.provider.mget<T>(keys);
    } catch (err) {
      this.logger.error(`Cache mget failed for ${keys.length} keys`, err);
      return keys.map(() => null);
    }
  }

  // Writes many keys at once with one shared TTL — errors are logged and swallowed
  async mset<T>(entries: { key: string; value: T }[], ttlSeconds: number): Promise<void> {
    try {
      await this.provider.mset(entries, ttlSeconds);
    } catch (err) {
      this.logger.error(`Cache mset failed for ${entries.length} keys`, err);
    }
  }

  // Deletes one or more keys — errors are logged and swallowed
  async del(...keys: string[]): Promise<void> {
    try {
      await this.provider.del(...keys);
    } catch (err) {
      this.logger.error(`Cache del failed for keys "${keys.join(', ')}"`, err);
    }
  }

  // Returns all keys matching a glob pattern — returns empty array on error
  async scanKeys(pattern: string): Promise<string[]> {
    try {
      return await this.provider.scanKeys(pattern);
    } catch (err) {
      this.logger.error(`Cache scanKeys failed for pattern "${pattern}"`, err);
      return [];
    }
  }

  // Returns raw memory info from the provider — returns empty string on error
  async getMemoryInfo(): Promise<string> {
    try {
      return await this.provider.getMemoryInfo();
    } catch (err) {
      this.logger.error('Cache getMemoryInfo failed', err);
      return '';
    }
  }
}

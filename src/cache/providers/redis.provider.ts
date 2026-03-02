import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { ICacheProvider } from '../interfaces/cache-provider.interface';

@Injectable()
export class RedisCacheProvider implements ICacheProvider, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheProvider.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  // Creates the ioredis client and attaches connection/error listeners
  onModuleInit(): void {
    const url = this.configService.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  // Gracefully closes the ioredis connection on app shutdown
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  // Serializes value to JSON and stores with a mandatory TTL
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const json = JSON.stringify(value);
    await this.client.setex(key, ttlSeconds, json);
  }

  // Reads the stored JSON string and parses back to the original type
  async get<T>(key: string): Promise<T | null> {
    const json = await this.client.get(key);
    if (!json) return null;
    return JSON.parse(json) as T;
  }

  // Deletes one or more keys in a single command
  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // Cursor-iterates all keys matching a glob pattern — never uses KEYS command
  async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  // Returns raw INFO memory output for memory monitoring
  async getMemoryInfo(): Promise<string> {
    return this.client.info('memory');
  }
}

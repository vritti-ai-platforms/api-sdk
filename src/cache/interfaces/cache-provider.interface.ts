// Contract that every cache provider must implement
export interface ICacheProvider {
  // Serializes value to JSON, compresses with gzip, stores with mandatory TTL
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  // Returns the stored value decompressed and parsed, or null on cache miss
  get<T>(key: string): Promise<T | null>;

  // Deletes one or more keys
  del(...keys: string[]): Promise<void>;

  // Returns all keys matching a glob pattern (cursor-based, never uses KEYS)
  scanKeys(pattern: string): Promise<string[]>;

  // Returns raw provider memory info string (for monitoring utilities)
  getMemoryInfo(): Promise<string>;
}

export interface ICacheProvider {
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  get<T>(key: string): Promise<T | null>;

  mget<T>(keys: string[]): Promise<(T | null)[]>;

  mset<T>(entries: { key: string; value: T }[], ttlSeconds: number): Promise<void>;

  del(...keys: string[]): Promise<void>;

  scanKeys(pattern: string): Promise<string[]>;

  getMemoryInfo(): Promise<string>;
}

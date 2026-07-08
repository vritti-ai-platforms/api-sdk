export interface ICacheProvider {
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  get<T>(key: string): Promise<T | null>;

  del(...keys: string[]): Promise<void>;

  scanKeys(pattern: string): Promise<string[]>;

  getMemoryInfo(): Promise<string>;
}

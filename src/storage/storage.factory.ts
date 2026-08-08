import { readConfigSource, type StorageConfigSource } from './config-source';
import { R2StorageProvider } from './providers/r2-storage.provider';
import type { R2StorageConfig, StorageProvider } from './types';

export interface StorageFactoryOptions {
  r2?: StorageConfigSource<R2StorageConfig>;
}

export class StorageFactory {
  private readonly cache = new Map<string, StorageProvider>();

  constructor(private readonly options: StorageFactoryOptions) {}

  // Resolves a provider by name, constructing it once on first use
  resolve(provider: string): StorageProvider {
    const cached = this.cache.get(provider);
    if (cached) return cached;

    const created = this.create(provider);
    this.cache.set(provider, created);
    return created;
  }

  private create(provider: string): StorageProvider {
    switch (provider) {
      case 'r2':
        return new R2StorageProvider(readConfigSource(this.options.r2, 'r2'));
      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }
}

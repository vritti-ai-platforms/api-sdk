import { readConfigSource, type StorageConfigSource } from './config-source';
import { R2BucketProvisioner } from './provisioners/r2-bucket.provisioner';
import type { R2ProvisionerConfig, StorageProvisioner } from './types';

export interface StorageProvisionerFactoryOptions {
  r2?: StorageConfigSource<R2ProvisionerConfig>;
}

// Mirrors StorageFactory for the admin side: same provider names, same lazy config, different job. Resolves a generic
// StorageProvisioner (bucket + credential admin) by provider name so the caller is not pinned to a single backend.
export class StorageProvisionerFactory {
  private readonly cache = new Map<string, StorageProvisioner>();

  constructor(private readonly options: StorageProvisionerFactoryOptions) {}

  // Resolves a provisioner by provider name, constructing it once on first use
  resolve(provider: string): StorageProvisioner {
    const cached = this.cache.get(provider);
    if (cached) return cached;

    const created = this.create(provider);
    this.cache.set(provider, created);
    return created;
  }

  private create(provider: string): StorageProvisioner {
    switch (provider) {
      case 'r2':
        return new R2BucketProvisioner(readConfigSource(this.options.r2, 'r2'));
      default:
        throw new Error(`Unsupported storage provisioner: ${provider}`);
    }
  }
}

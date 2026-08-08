import { readConfigSource, type StorageConfigSource } from './config-source';
import { R2BucketProvisioner } from './provisioners/r2-bucket.provisioner';
import type { OrgStorageProvisioner, R2ProvisionerConfig } from './types';

export interface OrgStorageProvisionerFactoryOptions {
  r2?: StorageConfigSource<R2ProvisionerConfig>;
}

// Mirrors StorageFactory for the control-plane side: same provider names, same lazy config, different job
export class OrgStorageProvisionerFactory {
  private readonly cache = new Map<string, OrgStorageProvisioner>();

  constructor(private readonly options: OrgStorageProvisionerFactoryOptions) {}

  // Resolves a provisioner by provider name, constructing it once on first use
  resolve(provider: string): OrgStorageProvisioner {
    const cached = this.cache.get(provider);
    if (cached) return cached;

    const created = this.create(provider);
    this.cache.set(provider, created);
    return created;
  }

  private create(provider: string): OrgStorageProvisioner {
    switch (provider) {
      case 'r2':
        return new R2BucketProvisioner(readConfigSource(this.options.r2, 'r2'));
      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }
}

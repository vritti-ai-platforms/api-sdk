import type { Readable } from 'node:stream';

export interface UploadParams {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  bucket?: string;
}

export interface StoredObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface ListObjectsPage {
  objects: StoredObject[];
  // Absent on the final page. S3 lists 1000 keys at a time, so a full sweep is a loop, not one call.
  nextToken?: string;
}

// A storage backend. Every method takes an optional bucket so multi-tenant callers can address a per-tenant bucket
// while single-tenant callers fall back to the bucket the provider was configured with.
export interface StorageProvider {
  upload(params: UploadParams): Promise<string>;
  uploadPublic(key: string, body: Buffer, contentType: string, bucket?: string): Promise<string>;
  getPublicUrl(key: string, bucket?: string): string;
  delete(key: string, bucket?: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number, bucket?: string): Promise<string>;
  getStream(key: string, bucket?: string): Promise<Readable>;
  listObjects(bucket: string, continuationToken?: string): Promise<ListObjectsPage>;
}

export interface ScopedTokenResult {
  id: string;
  value: string;
}

// Generic storage-admin client — the org-agnostic mirror of StorageProvider (reads): create/delete buckets, toggle a
// bucket's public domain, and mint/revoke bucket-scoped credentials. Naming and orchestration live in the caller.
export interface StorageProvisioner {
  createBucket(name: string): Promise<void>;
  deleteBucket(name: string): Promise<void>;
  enablePublicAccess(bucket: string): Promise<string>;
  createScopedToken(name: string, buckets: string[]): Promise<ScopedTokenResult>;
  deleteCredential(accessKeyId: string): Promise<void>;
}

export interface R2ProvisionerConfig {
  accountId: string;
  // Bearer token with Workers R2 Storage:Edit — creates and deletes buckets
  adminToken: string;
  // Bearer token with API Tokens:Edit — mints the bucket-scoped credential
  tokensToken: string;
  // R2 placement hint; 'apac' keeps objects near an India-served deployment
  locationHint?: string;
  // Must match the bucket's jurisdiction, because it is embedded in the token's resource key
  jurisdiction?: string;
}

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  // Multi-tenant callers pass the bucket per call and leave these unset; single-bucket callers set them instead
  defaultBucket?: string;
  publicBucket?: string;
  // Base URL of the public bucket's custom domain; keys are appended to it verbatim. R2 binds a domain to a single
  // bucket, so this is only meaningful for a single-bucket caller — per-tenant public buckets have no shared base.
  publicUrl?: string;
}

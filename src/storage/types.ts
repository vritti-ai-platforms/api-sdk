import type { Readable } from 'node:stream';

export interface UploadParams {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  bucket?: string;
}

// A storage backend. Every method takes an optional bucket so multi-tenant callers can address a per-org bucket
// while single-tenant callers fall back to the bucket the provider was configured with.
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

export interface StorageProvider {
  upload(params: UploadParams): Promise<string>;
  uploadPublic(key: string, body: Buffer, contentType: string, bucket?: string): Promise<string>;
  getPublicUrl(key: string, bucket?: string): string;
  delete(key: string, bucket?: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number, bucket?: string): Promise<string>;
  getStream(key: string, bucket?: string): Promise<Readable>;
  listObjects(bucket: string, continuationToken?: string): Promise<ListObjectsPage>;
}

export interface OrgBuckets {
  storageBucket: string;
  storagePublicBucket: string;
}

// Creates the buckets and the scoped credential that back one org's storage, returning the descriptor to persist.
// Separate from StorageProvider because provisioning is a control-plane job the uploading server never performs, and
// it does not speak S3 at all — minting credentials and marking a bucket public are both provider REST APIs.
// Just the S3 pair — what a rotation replaces, without the buckets and URL that stay the same
export interface OrgCredential {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface OrgStorageProvisioner {
  provisionOrg(subdomain: string): Promise<OrgStorage>;
  rotateCredential(subdomain: string, buckets: OrgBuckets): Promise<OrgCredential>;
  deleteOrgBuckets(buckets: OrgBuckets): Promise<void>;
  deleteCredential(accessKeyId: string): Promise<void>;
}

// The control plane's view of an org's storage: just the buckets it provisioned. No credential — that lives only on
// the server that uploads, and a second copy of a live secret is a second thing to leak. No usage figure either:
// usage is read from the provider on demand, so there is no cached number to go stale.
export interface OrgStorageTracking {
  bucket: string;
  publicBucket: string;
  // The token id, kept control-plane side so a credential can be revoked without asking the uploading server for it.
  // An id alone grants nothing — the secret stays only where uploads happen.
  accessKeyId: string | null;
}

export interface R2ProvisionerConfig {
  accountId: string;
  // Bearer token with Workers R2 Storage:Edit — creates buckets
  adminToken: string;
  // Bearer token with API Tokens:Edit — mints the per-org bucket-scoped credential
  tokensToken: string;
  // R2 placement hint; 'apac' keeps objects near an India-served deployment
  locationHint?: string;
  // Must match the bucket's jurisdiction, because it is embedded in the token's resource key
  jurisdiction?: string;
}

// One org's own storage: its buckets and the credentials scoped to them. Written by the control plane at
// provisioning time and stored verbatim on the organization row.
//
// The bucket names are the SOURCE OF TRUTH and must never be recomputed from the subdomain — an org that renames its
// subdomain keeps addressing the objects it already stored.
//
// accessKeyId doubles as the provider's handle on the credential (on R2 it is the Cloudflare API token id, since R2
// derives the S3 pair from the token: key id = token id, secret = SHA-256 of the token value), which is what makes
// rotation and revocation possible without storing anything else.
export interface OrgStorage {
  provider: 'r2';
  // Kept on the descriptor rather than read from the reading server's env, so an org's storage is fully self-contained
  // and portable — the endpoint is derived from it (https://<accountId>.r2.cloudflarestorage.com)
  accountId: string;
  bucket: string;
  publicBucket: string;
  // Public base URL of publicBucket, captured when public access was enabled. Stored rather than derived because R2
  // binds a domain to a single bucket and assigns the managed one (pub-<hash>.r2.dev) itself — with a bucket per org
  // there is no shared base to compute from. Null when public access could not be enabled.
  publicUrl: string | null;
  accessKeyId: string;
  // Whatever the writer stored — plaintext or ciphertext. Readers must apply the same treatment as the writer.
  secretAccessKey: string;
  createdAt: string;
}

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  // Multi-tenant callers pass the org's bucket per call and leave these unset; single-bucket callers set them instead
  defaultBucket?: string;
  publicBucket?: string;
  // Base URL of the public bucket's custom domain; keys are appended to it verbatim. R2 binds a domain to a single
  // bucket, so this is only meaningful for a single-bucket caller — per-org public buckets have no shared base.
  publicUrl?: string;
}

import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { OrgBuckets, OrgCredential, OrgStorage, OrgStorageProvisioner, R2ProvisionerConfig } from '../types';

const CF_API = 'https://api.cloudflare.com/client/v4';

// Bucket-level group: read/write/list objects in named buckets. Deliberately NOT 'Workers R2 Storage Write', which is
// account-level and can create and delete buckets — exactly what a tenant credential must never do.
const BUCKET_ITEM_WRITE = 'Workers R2 Storage Bucket Item Write';

// Bucket names are prefixed because the account also holds Vritti's own buckets, and a subdomain like "media" collides
export function orgBucketNames(subdomain: string): OrgBuckets {
  return { storageBucket: `org-${subdomain}`, storagePublicBucket: `org-${subdomain}-public` };
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
}

export class R2BucketProvisioner implements OrgStorageProvisioner {
  private readonly logger = new Logger(R2BucketProvisioner.name);
  private readonly jurisdiction: string;
  private bucketItemWriteGroupId: string | null = null;

  constructor(private readonly config: R2ProvisionerConfig) {
    this.jurisdiction = config.jurisdiction ?? 'default';
  }

  // Creates the org's two buckets and one credential scoped to just those buckets
  async provisionOrg(subdomain: string): Promise<OrgStorage> {
    const names = orgBucketNames(subdomain);
    await this.createBucket(names.storageBucket);
    await this.createBucket(names.storagePublicBucket);

    // Not fatal: an org whose public bucket is private still works for every presigned read, and the URL can be
    // filled in later. Failing the whole signup over a CDN convenience would be the wrong trade.
    let publicUrl: string | null = null;
    try {
      publicUrl = await this.enablePublicAccess(names.storagePublicBucket);
    } catch (error: unknown) {
      this.logger.warn(`Public access not enabled for ${names.storagePublicBucket}: ${error}`);
    }

    const token = await this.createScopedToken(subdomain, [names.storageBucket, names.storagePublicBucket]);

    return {
      provider: 'r2',
      accountId: this.config.accountId,
      bucket: names.storageBucket,
      publicBucket: names.storagePublicBucket,
      publicUrl,
      accessKeyId: token.id,
      // R2 derives the S3 pair from the token: key id = token id, secret = SHA-256 of the token value. The value is
      // returned exactly once, so it is hashed here rather than handed back to a caller that might drop it.
      secretAccessKey: createHash('sha256').update(token.value).digest('hex'),
      createdAt: new Date().toISOString(),
    };
  }

  // Mints a replacement credential scoped to the same buckets. Returns only the credential pair, not a whole
  // descriptor: the control plane does not hold the org's publicUrl, so it is in no position to rebuild one.
  //
  // The old token is NOT revoked here. Revoking before the caller has persisted the new credential would leave the org
  // with no working key in the gap; deleteCredential is a separate call, made once the new one is stored.
  async rotateCredential(subdomain: string, buckets: OrgBuckets): Promise<OrgCredential> {
    const token = await this.createScopedToken(subdomain, [buckets.storageBucket, buckets.storagePublicBucket]);

    return {
      accessKeyId: token.id,
      secretAccessKey: createHash('sha256').update(token.value).digest('hex'),
    };
  }

  // Removes an org's buckets. R2 refuses to delete a bucket that still holds objects, so the uploading server must
  // have emptied them first — a 'not empty' failure here means that step did not finish.
  async deleteOrgBuckets(buckets: OrgBuckets): Promise<void> {
    for (const bucket of [buckets.storageBucket, buckets.storagePublicBucket]) {
      const response = await fetch(`${CF_API}/accounts/${this.config.accountId}/r2/buckets/${bucket}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.config.adminToken}` },
      });

      const body = (await response.json()) as CloudflareEnvelope<unknown>;
      // 10006 is "bucket not found" — already gone, which is the state we wanted
      if (body.success || body.errors?.some((e) => e.code === 10006)) {
        this.logger.log(`Deleted bucket ${bucket}`);
        continue;
      }
      throw new Error(`Cloudflare bucket delete failed for ${bucket}: ${this.describe(body)}`);
    }
  }

  // Revokes a credential by its access key id, which on R2 is the Cloudflare token id
  async deleteCredential(accessKeyId: string): Promise<void> {
    const response = await fetch(`${CF_API}/accounts/${this.config.accountId}/tokens/${accessKeyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.tokensToken}` },
    });

    const body = (await response.json()) as CloudflareEnvelope<unknown>;
    if (!body.success) {
      throw new Error(`Cloudflare token delete failed for ${accessKeyId}: ${this.describe(body)}`);
    }

    this.logger.log(`Revoked storage credential ${accessKeyId}`);
  }

  // Creates one bucket, treating an existing bucket as success so provisioning can be re-run to reconcile
  private async createBucket(name: string): Promise<void> {
    const response = await fetch(`${CF_API}/accounts/${this.config.accountId}/r2/buckets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.adminToken}`,
        'Content-Type': 'application/json',
        'cf-r2-jurisdiction': this.jurisdiction,
      },
      body: JSON.stringify({
        name,
        ...(this.config.locationHint && { locationHint: this.config.locationHint }),
      }),
    });

    const body = (await response.json()) as CloudflareEnvelope<unknown>;
    if (body.success) {
      this.logger.log(`Created bucket ${name}`);
      return;
    }

    // 10004 is "bucket already exists" — two provisioning attempts racing, or a reconcile pass
    if (body.errors?.some((e) => e.code === 10004)) return;
    throw new Error(`Cloudflare bucket create failed for ${name}: ${this.describe(body)}`);
  }

  // Turns on the bucket's Cloudflare-managed domain and returns it. NOTE: r2.dev is rate limited and documented as
  // non-production — sustained traffic gets 429s. A custom domain per bucket is the production answer, and drops into
  // this same field.
  private async enablePublicAccess(bucket: string): Promise<string | null> {
    const response = await fetch(`${CF_API}/accounts/${this.config.accountId}/r2/buckets/${bucket}/domains/managed`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${this.config.adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    const body = (await response.json()) as CloudflareEnvelope<{ domain?: string; enabled?: boolean }>;
    if (!body.success || !body.result?.domain) {
      throw new Error(`Cloudflare enable public access failed for ${bucket}: ${this.describe(body)}`);
    }

    this.logger.log(`Enabled public access for ${bucket} → ${body.result.domain}`);
    return `https://${body.result.domain}`;
  }

  // Mints an ACCOUNT-owned token that can only touch this org's buckets. Account-owned rather than user-owned so a
  // tenant's credential does not die with whichever Cloudflare user happened to create the parent token. Requires the
  // parent to hold `Account API Tokens Write`; a user-scoped `API Tokens: Edit` token is rejected here with 9109.
  private async createScopedToken(subdomain: string, buckets: string[]): Promise<{ id: string; value: string }> {
    const permissionGroupId = await this.resolveBucketItemWriteGroupId();

    // The jurisdiction is embedded in the resource key and must match the bucket's, or the token authenticates fine
    // and then 403s on every object because it is scoped to a bucket that does not exist
    const resources = Object.fromEntries(
      buckets.map((bucket) => [
        `com.cloudflare.edge.r2.bucket.${this.config.accountId}_${this.jurisdiction}_${bucket}`,
        '*',
      ]),
    );

    const response = await fetch(`${CF_API}/accounts/${this.config.accountId}/tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.tokensToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `org-${subdomain}`,
        policies: [{ effect: 'allow', permission_groups: [{ id: permissionGroupId }], resources }],
      }),
    });

    const body = (await response.json()) as CloudflareEnvelope<{ id: string; value: string }>;
    if (!body.success || !body.result?.value) {
      throw new Error(`Cloudflare token create failed for org-${subdomain}: ${this.describe(body)}`);
    }

    this.logger.log(`Minted storage credential for org-${subdomain} scoped to ${buckets.length} bucket(s)`);
    return body.result;
  }

  // The create-token API takes permission group UUIDs, not names. Looked up once rather than hardcoded: a UUID copied
  // from docs fails much later with an error that says nothing useful. Same account-scoped endpoint as creation.
  private async resolveBucketItemWriteGroupId(): Promise<string> {
    if (this.bucketItemWriteGroupId) return this.bucketItemWriteGroupId;

    const response = await fetch(`${CF_API}/accounts/${this.config.accountId}/tokens/permission_groups`, {
      headers: { Authorization: `Bearer ${this.config.tokensToken}` },
    });

    const body = (await response.json()) as CloudflareEnvelope<{ id: string; name: string }[]>;
    const group = body.result?.find((g) => g.name === BUCKET_ITEM_WRITE);
    if (!group) {
      throw new Error(`Cloudflare permission group '${BUCKET_ITEM_WRITE}' not found: ${this.describe(body)}`);
    }

    this.bucketItemWriteGroupId = group.id;
    return group.id;
  }

  private describe(body: CloudflareEnvelope<unknown>): string {
    return body.errors?.map((e) => `${e.code} ${e.message}`).join('; ') || 'unknown error';
  }
}

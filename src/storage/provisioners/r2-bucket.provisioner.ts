import { Logger } from '@nestjs/common';
import type { R2ProvisionerConfig } from '../types';

const CF_API = 'https://api.cloudflare.com/client/v4';

// Bucket-level group: read/write/list objects in named buckets. Deliberately NOT 'Workers R2 Storage Write', which is
// account-level and can create and delete buckets — exactly what a tenant credential must never do.
const BUCKET_ITEM_WRITE = 'Workers R2 Storage Bucket Item Write';

interface CloudflareEnvelope<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
}

// Generic R2 admin client: create/delete buckets, toggle a bucket's Cloudflare-managed public domain, and mint/revoke
// bucket-scoped credentials. It has NO notion of organizations — bucket naming, which buckets a tenant gets, and how
// the stored descriptor is assembled all live in the caller. Every operation is a Cloudflare REST call.
export class R2BucketProvisioner {
  private readonly logger = new Logger(R2BucketProvisioner.name);
  private readonly jurisdiction: string;
  private bucketItemWriteGroupId: string | null = null;

  constructor(private readonly config: R2ProvisionerConfig) {
    this.jurisdiction = config.jurisdiction ?? 'default';
  }

  // Creates one bucket, treating an existing bucket as success so provisioning can be re-run to reconcile
  async createBucket(name: string): Promise<void> {
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

  // Deletes one bucket. R2 refuses to delete a bucket that still holds objects, so the caller must have emptied it
  // first — a 'not empty' failure here means that step did not finish. A missing bucket counts as success.
  async deleteBucket(name: string): Promise<void> {
    const response = await fetch(`${CF_API}/accounts/${this.config.accountId}/r2/buckets/${name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.config.adminToken}` },
    });

    const body = (await response.json()) as CloudflareEnvelope<unknown>;
    // 10006 is "bucket not found" — already gone, which is the state we wanted
    if (body.success || body.errors?.some((e) => e.code === 10006)) {
      this.logger.log(`Deleted bucket ${name}`);
      return;
    }
    throw new Error(`Cloudflare bucket delete failed for ${name}: ${this.describe(body)}`);
  }

  // Turns on the bucket's Cloudflare-managed domain and returns its https URL. NOTE: r2.dev is rate limited and
  // documented as non-production — sustained traffic gets 429s. A custom domain per bucket is the production answer,
  // and drops into this same field. Throws on failure; the caller decides whether that is fatal.
  async enablePublicAccess(bucket: string): Promise<string> {
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

  // Mints an ACCOUNT-owned token that can only touch the named buckets. Account-owned rather than user-owned so a
  // tenant's credential does not die with whichever Cloudflare user happened to create the parent token. Requires the
  // parent to hold `Account API Tokens Write`; a user-scoped `API Tokens: Edit` token is rejected here with 9109.
  // `name` is the token's display label; the value is returned by R2 exactly once.
  async createScopedToken(name: string, buckets: string[]): Promise<{ id: string; value: string }> {
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
        name,
        policies: [{ effect: 'allow', permission_groups: [{ id: permissionGroupId }], resources }],
      }),
    });

    const body = (await response.json()) as CloudflareEnvelope<{ id: string; value: string }>;
    if (!body.success || !body.result?.value) {
      throw new Error(`Cloudflare token create failed for ${name}: ${this.describe(body)}`);
    }

    this.logger.log(`Minted storage credential ${name} scoped to ${buckets.length} bucket(s)`);
    return body.result;
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

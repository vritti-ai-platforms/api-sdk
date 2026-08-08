import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import { NotFoundException } from '../../exceptions';
import type { ListObjectsPage, R2StorageConfig, StorageProvider, UploadParams } from '../types';

export class R2StorageProvider implements StorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly client: S3Client;

  constructor(private readonly config: R2StorageConfig) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  // Uploads a file buffer or stream
  async upload(params: UploadParams): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.requireBucket(params.bucket, this.config.defaultBucket),
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );

    this.logger.log(`Uploaded file to R2: ${params.key}`);
    return params.key;
  }

  // Uploads a file to a public bucket and returns its permanent URL
  async uploadPublic(key: string, body: Buffer, contentType: string, bucket?: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.requireBucket(bucket, this.config.publicBucket),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const url = this.getPublicUrl(key);
    this.logger.log(`Uploaded public file to R2: ${key} → ${url}`);
    return url;
  }

  // Public URLs come from the configured custom domain, which maps to one bucket — R2 has no per-bucket URL to derive,
  // so a multi-tenant caller with a bucket per org cannot build one at all
  getPublicUrl(key: string): string {
    if (!this.config.publicUrl) {
      throw new Error('R2 storage has no publicUrl configured; public URLs cannot be built.');
    }
    return `${this.config.publicUrl}/${key}`;
  }

  // Deletes a file
  async delete(key: string, bucket?: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket ?? this.config.defaultBucket, Key: key }));

    this.logger.log(`Deleted file from R2: ${key}`);
  }

  // Generates a presigned download URL (default 1 hour)
  async getSignedUrl(key: string, expiresInSeconds = 3600, bucket?: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.requireBucket(bucket, this.config.defaultBucket), Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  // Returns a readable stream
  async getStream(key: string, bucket?: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.requireBucket(bucket, this.config.defaultBucket), Key: key }),
    );

    if (!response.Body) {
      throw new NotFoundException('File not found in storage.');
    }

    return response.Body as Readable;
  }

  // One page of a bucket's contents. S3 has no "list everything" call and no bucket-size call — a full inventory is
  // this looped until nextToken is absent, and each page is a Class A request.
  async listObjects(bucket: string, continuationToken?: string): Promise<ListObjectsPage> {
    const response = await this.client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }),
    );

    return {
      objects: (response.Contents ?? []).map((o) => ({
        key: o.Key ?? '',
        size: o.Size ?? 0,
        lastModified: o.LastModified ?? new Date(0),
      })),
      nextToken: response.NextContinuationToken,
    };
  }

  // Failing loudly here beats letting a missing org bucket fall through to some other tenant's default
  private requireBucket(bucket: string | undefined, fallback: string | undefined): string {
    const resolved = bucket ?? fallback;
    if (!resolved) {
      throw new Error('No bucket supplied and R2 storage has no default bucket configured.');
    }
    return resolved;
  }
}

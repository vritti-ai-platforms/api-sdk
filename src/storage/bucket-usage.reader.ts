import { Logger } from '@nestjs/common';

const CF_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

export interface BucketUsage {
  bytes: number;
  objectCount: number;
}

export interface BucketUsageReaderConfig {
  accountId: string;
  // Account-level token with Analytics Read. NOT the org's scoped S3 credential and NOT the R2 admin token: the
  // analytics dataset is filtered by accountTag and is not reachable with object-level credentials.
  analyticsToken: string;
}

// r2StorageAdaptiveGroups is a time series, so the newest bucketed sample is the closest thing to "current". It lags
// real writes by minutes — fine for a periodic quota check, useless for gating an individual upload.
//
// `dimensions { datetime }` is required, not decorative: ordering by a field that is neither aggregated nor selected
// as a dimension is rejected. Keep the query free of `#` comments too — Cloudflare's parser rejects them.
const QUERY = `query BucketUsage($accountTag: string!, $bucketName: string, $start: Time, $end: Time) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2StorageAdaptiveGroups(
        limit: 1
        filter: { datetime_geq: $start, datetime_leq: $end, bucketName: $bucketName }
        orderBy: [datetime_DESC]
      ) {
        max { objectCount payloadSize metadataSize }
        dimensions { datetime }
      }
    }
  }
}`;

interface UsageResponse {
  errors?: { message: string }[];
  data?: {
    viewer?: {
      accounts?: {
        r2StorageAdaptiveGroups?: {
          max?: { objectCount?: number; payloadSize?: number; metadataSize?: number };
        }[];
      }[];
    };
  };
}

// Reads how much an org's bucket actually holds, straight from the provider — the authoritative figure a locally
// maintained counter would only ever approximate.
export class BucketUsageReader {
  private readonly logger = new Logger(BucketUsageReader.name);

  constructor(private readonly config: BucketUsageReaderConfig) {}

  // Returns the newest reported sample, or zeroes for a bucket the dataset has not reported on yet (a new or
  // empty bucket produces no rows at all rather than a row of zeroes)
  async getBucketUsage(bucketName: string, windowHours = 24): Promise<BucketUsage> {
    const end = new Date();
    const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000);

    const response = await fetch(CF_GRAPHQL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.analyticsToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          accountTag: this.config.accountId,
          bucketName,
          start: start.toISOString(),
          end: end.toISOString(),
        },
      }),
    });

    const body = (await response.json()) as UsageResponse;
    if (body.errors?.length) {
      throw new Error(
        `Cloudflare usage query failed for ${bucketName}: ${body.errors.map((e) => e.message).join('; ')}`,
      );
    }

    const sample = body.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0]?.max;
    if (!sample) {
      this.logger.debug(`No usage samples yet for bucket ${bucketName}`);
      return { bytes: 0, objectCount: 0 };
    }

    // Billed storage is payload plus per-object metadata, so both count against a quota
    return {
      bytes: (sample.payloadSize ?? 0) + (sample.metadataSize ?? 0),
      objectCount: sample.objectCount ?? 0,
    };
  }
}

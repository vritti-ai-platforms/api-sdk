import type { VersionSnapshot } from '../catalog-resolver/types';

export type { SignedDocument } from '../signing/document';

export interface CatalogLicense {
  deploymentId: string;
  version: string;
  // sha256 of the canonical snapshot — idempotency key
  hash: string;
  snapshot: VersionSnapshot;
  issuedAt: string;
}

export interface OrgEntitlement {
  deploymentId: string;
  orgId: string;
  planCode: string;
  businessCode: string;
  issuedAt: string;
}

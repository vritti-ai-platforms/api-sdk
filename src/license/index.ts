// License module — Ed25519-signed catalog + entitlement documents over canonical JSON
export { canonicalStringify, hashSnapshot } from './canonical';
export { generateLicenseKeyPair, signDocument, verifyDocument } from './signing';
export type { CatalogLicense, OrgEntitlement, SignedDocument } from './types';

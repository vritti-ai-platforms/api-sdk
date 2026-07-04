import { createHash } from 'node:crypto';
import { canonicalStringify } from '../signing/canonical';

// Computes the sha256 hex digest of a value's canonical JSON — idempotency key for catalog snapshots
export function hashSnapshot(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex');
}

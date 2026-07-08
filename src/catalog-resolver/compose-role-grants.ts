import { type FeatureUnlocks, PLATFORMS, type PlatformCodes, type PlatformDenyCodes } from './types';

export type RevokedGrants = Record<string, PlatformDenyCodes>;

export interface ComposeRoleGrantsParams {
  baseFeatures: FeatureUnlocks | undefined;
  additions: FeatureUnlocks;
  revoked: RevokedGrants | undefined;
}

// Deduped union of two optional code lists — undefined on both sides means no platform membership
function unionBucket(base: string[] | undefined, add: string[] | undefined): string[] | undefined {
  if (base === undefined && add === undefined) return undefined;
  return [...new Set([...(base ?? []), ...(add ?? [])])];
}

// Composes a custom role's effective grants: merge(base ∪ additions) − revoked (design doc §10); inputs are never mutated
export function composeRoleGrants(params: ComposeRoleGrantsParams): FeatureUnlocks {
  const { baseFeatures, additions, revoked } = params;

  const result: FeatureUnlocks = {};
  const featureCodes = new Set([...Object.keys(baseFeatures ?? {}), ...Object.keys(additions ?? {})]);

  for (const code of featureCodes) {
    const base = baseFeatures?.[code] ?? {};
    const add = additions?.[code] ?? {};
    const revokes = revoked?.[code];

    const composed: PlatformCodes = {};
    for (const bucket of PLATFORMS) {
      const merged = unionBucket(base[bucket], add[bucket]);
      if (merged === undefined) continue;
      const revoke = revokes?.[bucket];
      // null revokes the whole platform (membership + all codes); string[] subtracts codes but keeps membership
      if (revoke === null) continue;
      composed[bucket] = revoke === undefined ? merged : merged.filter((c) => !revoke.includes(c));
    }

    // A feature with no surviving platform membership disappears from the effective set
    if (composed.web === undefined && composed.mobile === undefined) continue;
    result[code] = composed;
  }

  return result;
}

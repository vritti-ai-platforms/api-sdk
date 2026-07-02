import type { RoleFeatureGrant } from './resolve-user-features';

export type RevokedGrants = Record<string, { web?: string[] | null; mobile?: string[] | null }>;

export interface ComposedRoleGrant {
  app?: string;
  web?: string[];
  mobile?: string[];
}

export interface ComposeRoleGrantsParams {
  baseFeatures: Record<string, RoleFeatureGrant> | undefined;
  additions: Record<string, RoleFeatureGrant>;
  revoked: RevokedGrants | undefined;
}

// Normalizes a grant to the per-platform object shape — legacy flat string[] counts as both-platform codes
function normalizeGrant(grant: RoleFeatureGrant | undefined): { app?: string; web?: string[]; mobile?: string[] } {
  if (grant === undefined) return {};
  if (Array.isArray(grant)) return { web: grant, mobile: grant };
  return grant;
}

// Deduped union of two optional code lists — undefined on both sides means no platform membership
function unionBucket(base: string[] | undefined, add: string[] | undefined): string[] | undefined {
  if (base === undefined && add === undefined) return undefined;
  return [...new Set([...(base ?? []), ...(add ?? [])])];
}

// Composes a based custom role's effective grants: merge(base ∪ additions) − revoked (design doc §10).
// Platform membership survives a code revoke (may leave [] = view-only); a null revoke removes the
// platform entirely; a feature with no surviving platform disappears. Inputs are never mutated.
export function composeRoleGrants(params: ComposeRoleGrantsParams): Record<string, ComposedRoleGrant> {
  const { baseFeatures, additions, revoked } = params;

  const result: Record<string, ComposedRoleGrant> = {};
  const featureCodes = new Set([...Object.keys(baseFeatures ?? {}), ...Object.keys(additions ?? {})]);

  for (const code of featureCodes) {
    const base = normalizeGrant(baseFeatures?.[code]);
    const add = normalizeGrant(additions?.[code]);
    const revokes = revoked?.[code];

    const composed: ComposedRoleGrant = {};
    // App comes from the base template first, else the role's own additions
    const app = base.app ?? add.app;
    if (app !== undefined) composed.app = app;

    for (const bucket of ['web', 'mobile'] as const) {
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

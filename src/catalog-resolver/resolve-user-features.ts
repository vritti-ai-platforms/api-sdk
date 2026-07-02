import { buildBuCatalog } from './catalog.builder';
import type { BuFeatureUnlocks, LockReason, VersionSnapshot } from './types';

// Client surface requesting resolution — web picks the WEB route block, ios/android pick the MOBILE block per-OS
export type ClientPlatform = 'web' | 'ios' | 'android';

// A granted permission that is locked, with why and which plans would unlock it (for upsell)
export interface LockedPermission {
  code: string;
  reason: LockReason | null;
  unlockPlans: string[];
}

export interface PermissionFeature {
  code: string;
  name: string;
  lucideIcon: string | null;
  sfSymbol: string;
  materialSymbol: string;
  permissions: string[];
  // Lock overlay (for upsell): feature-level locked + reason + unlock plans, and the granted-but-locked permissions
  locked: boolean;
  lockReason: LockReason | null;
  unlockPlans: string[];
  lockedPermissions: LockedPermission[];
  route: {
    remoteEntry: string;
    exposedModule: string;
    routePrefix: string;
  };
  appCode: string;
  appName: string;
  appIcon: string | null;
  appSortOrder: number;
}

// A role's grant for one feature — tolerates the legacy flat string[] shape during re-provisioning
export type RoleFeatureGrant = { app?: string; web?: string[]; mobile?: string[] } | string[];

export interface ResolveUserFeaturesParams {
  snapshot: VersionSnapshot;
  businessCode: string;
  planCode: string | undefined;
  // undefined = inherit the full plan
  buUnlocks: BuFeatureUnlocks | undefined;
  // The user's single role's grants: featureCode -> { app?, web?: [permCode…], mobile?: [permCode…] }
  roleFeatures: Record<string, RoleFeatureGrant>;
  platform: ClientPlatform;
}

// Resolves the features + MF config a user sees at a BU: plan ∧ BU catalog intersected with the role's grants.
// platform picks which microfrontend block flows into PermissionFeature.route:
//   'web'     → WEB block (remoteEntry + exposedModule + routePrefix)
//   'ios'     → MOBILE block, remoteEntry = remoteEntryIos
//   'android' → MOBILE block, remoteEntry = remoteEntryAndroid
// Features missing the requested platform's block are filtered out.
export function resolveUserFeatures(params: ResolveUserFeaturesParams): PermissionFeature[] {
  const { snapshot, businessCode, planCode, buUnlocks, roleFeatures, platform } = params;

  // Plan ∧ BU overlay — emits EVERY business feature (plan non-members come out fully locked with routes)
  const catalog = buildBuCatalog(snapshot, businessCode, planCode, buUnlocks);
  const catalogMap = new Map(catalog.map((f) => [f.code, f]));

  // Role grants are stored per platform; resolve only the requesting surface's bucket.
  // web → 'web'; ios/android → 'mobile'. (platform still drives the per-OS route below.)
  const bucket: 'web' | 'mobile' = platform === 'web' ? 'web' : 'mobile';

  // Granted permission set per feature, taking only this platform's grants
  const grantedFeatures = new Map<string, Set<string>>();
  for (const [code, grant] of Object.entries(roleFeatures ?? {})) {
    // Tolerate the legacy flat shape (string[]) during re-provisioning
    const granted = Array.isArray(grant) ? grant : grant?.[bucket];
    // Membership is the gate: undefined = not a member on this platform; [] = member with no actions (view-only)
    if (granted === undefined) continue;
    if (!grantedFeatures.has(code)) grantedFeatures.set(code, new Set());
    for (const perm of granted) grantedFeatures.get(code)?.add(perm);
  }

  // Cross-reference the granted features with the catalog to build the response
  const features: PermissionFeature[] = [];
  for (const [code, permsSet] of grantedFeatures) {
    const catalogEntry = catalogMap.get(code);
    if (!catalogEntry) continue;

    const route = pickRouteForPlatform(catalogEntry, platform);
    // Feature isn't published to this platform — omit so client doesn't see an unloadable tile.
    if (!route) continue;

    // Plan/BU lock a subset of permissions; surface which GRANTED ones are locked + why + how to unlock (upsell)
    const permByCode = new Map((catalogEntry.permissions ?? []).map((p) => [p.code, p]));
    const grantedPerms = [...permsSet];
    const lockedPermissions: LockedPermission[] = grantedPerms
      .map((c) => permByCode.get(c))
      .filter((p): p is NonNullable<typeof p> => !!p?.locked)
      .map((p) => ({ code: p.code, reason: p.lockReason ?? null, unlockPlans: p.unlockPlans ?? [] }));

    features.push({
      code,
      name: catalogEntry.name,
      lucideIcon: catalogEntry.lucideIcon,
      sfSymbol: catalogEntry.sfSymbol,
      materialSymbol: catalogEntry.materialSymbol,
      permissions: grantedPerms,
      locked: catalogEntry.locked ?? false,
      lockReason: catalogEntry.lockReason ?? null,
      unlockPlans: catalogEntry.unlockPlans ?? [],
      lockedPermissions,
      route,
      appCode: catalogEntry.appCode,
      appName: catalogEntry.appName,
      appIcon: catalogEntry.appIcon,
      appSortOrder: catalogEntry.appSortOrder,
    });
  }

  return features;
}

// Selects the route block from a catalog entry for the requested platform.
// Returns null when the catalog entry doesn't publish to that platform.
export function pickRouteForPlatform(
  entry: {
    web: {
      remoteEntry: string;
      exposedModule: string;
      routePrefix: string;
    } | null;
    mobile: {
      remoteEntryAndroid: string;
      remoteEntryIos: string;
      exposedModule: string;
      routePrefix: string;
    } | null;
  },
  platform: ClientPlatform,
): { remoteEntry: string; exposedModule: string; routePrefix: string } | null {
  if (platform === 'ios' || platform === 'android') {
    if (!entry.mobile) return null;
    return {
      remoteEntry: platform === 'ios' ? entry.mobile.remoteEntryIos : entry.mobile.remoteEntryAndroid,
      exposedModule: entry.mobile.exposedModule,
      routePrefix: entry.mobile.routePrefix,
    };
  }
  // Web
  if (!entry.web) return null;
  return {
    remoteEntry: entry.web.remoteEntry,
    exposedModule: entry.web.exposedModule,
    routePrefix: entry.web.routePrefix,
  };
}

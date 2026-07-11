import { buildSiteCatalog } from './catalog.builder';
import { buildDependsMap, filterGrantedByDeps } from './permission-deps';
import type {
  SiteFeatureLocks,
  FeatureUnlocks,
  LockReason,
  PlatformBucket,
  ScopeType,
  SiteType,
  VersionSnapshot,
} from './types';

export type ClientPlatform = 'web' | 'ios' | 'android';

export interface LockedPermission {
  code: string;
  reason: LockReason | null;
  unlockPlans: string[];
}

export interface PlanUpsell {
  plan: string;
  features: string[];
}

export interface PermissionFeature {
  code: string;
  name: string;
  lucideIcon: string | null;
  sfSymbol: string;
  materialSymbol: string;
  permissions: string[];
  locked: boolean;
  lockReason: LockReason | null;
  unlockPlans: string[];
  lockedPermissions: LockedPermission[];
  upsell: PlanUpsell[];
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

export interface ResolveUserFeaturesParams {
  snapshot: VersionSnapshot;
  businessCode: string;
  planCode: string | undefined;
  siteLocks: SiteFeatureLocks | undefined;
  roleFeatures: FeatureUnlocks;
  platform: ClientPlatform;
  siteType?: SiteType;
  scope?: ScopeType;
}

// Resolves the features + MF config a user sees at a BU: plan ∧ BU catalog intersected with the role's grants, filtered to the requested platform
export function resolveUserFeatures(params: ResolveUserFeaturesParams): PermissionFeature[] {
  const { snapshot, businessCode, planCode, siteLocks, roleFeatures, platform, siteType, scope } = params;

  // Plan unlocks, BU locks, and role grants are stored per platform; resolve only the requesting surface's bucket (web → 'web'; ios/android → 'mobile')
  const bucket: PlatformBucket = platform === 'web' ? 'web' : 'mobile';

  // Plan ∧ BU overlay for this bucket, filtered to features that apply to this workspace scope and node type — emits EVERY applicable business feature (plan non-members come out fully locked)
  const catalog = buildSiteCatalog(snapshot, businessCode, planCode, siteLocks, bucket, siteType, scope);
  const catalogMap = new Map(catalog.map((f) => [f.code, f]));

  // Per-plan feature-name delta vs the current plan — feeds the plan-locked upsell screen
  const businessPlans = snapshot.businesses[businessCode]?.plans ?? {};
  const currentUnlockedCodes = new Set<string>();
  if (planCode && businessPlans[planCode]) {
    for (const [featureCode, platforms] of Object.entries(businessPlans[planCode].unlockedPermissions ?? {})) {
      if (platforms?.[bucket] !== undefined) currentUnlockedCodes.add(featureCode);
    }
  }
  const planAdds = new Map<string, Array<{ code: string; name: string }>>();
  for (const [planKey, plan] of Object.entries(businessPlans)) {
    if (planKey === planCode) continue;
    const adds: Array<{ code: string; name: string }> = [];
    for (const [featureCode, platforms] of Object.entries(plan.unlockedPermissions ?? {})) {
      if (platforms?.[bucket] === undefined || currentUnlockedCodes.has(featureCode)) continue;
      const name = snapshot.features[featureCode]?.name;
      if (name) adds.push({ code: featureCode, name });
    }
    planAdds.set(planKey, adds);
  }

  // Granted permission set per feature, taking only this platform's grants
  const grantedFeatures = new Map<string, Set<string>>();
  for (const [code, grant] of Object.entries(roleFeatures ?? {})) {
    // Membership is the gate: undefined = not a member on this platform; [] = member with no actions (view-only)
    const granted = grant?.[bucket];
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

    // Drop granted permissions whose intra-feature prerequisites aren't also granted (e.g. add needs view)
    const featureDeps = buildDependsMap(snapshot.features[code]?.permissions ?? []);
    // Plan/BU lock a subset of permissions; surface which GRANTED ones are locked + why + how to unlock (upsell)
    const permByCode = new Map((catalogEntry.permissions ?? []).map((p) => [p.code, p]));
    const grantedPerms = [...filterGrantedByDeps(permsSet, featureDeps)];
    const lockedPermissions: LockedPermission[] = grantedPerms
      .map((c) => permByCode.get(c))
      .filter((p): p is NonNullable<typeof p> => !!p?.locked)
      .map((p) => ({ code: p.code, reason: p.lockReason ?? null, unlockPlans: p.unlockPlans ?? [] }));

    // For a plan-locked feature, list the extra features each unlocking plan would add (excluding this feature)
    const upsell: PlanUpsell[] =
      catalogEntry.locked && catalogEntry.lockReason === 'PLAN'
        ? (catalogEntry.unlockPlans ?? [])
            .map((plan) => ({
              plan,
              features: (planAdds.get(plan) ?? []).filter((f) => f.code !== code).map((f) => f.name),
            }))
            .filter((group) => group.features.length > 0)
        : [];

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
      upsell,
      route,
      appCode: catalogEntry.appCode,
      appName: catalogEntry.appName,
      appIcon: catalogEntry.appIcon,
      appSortOrder: catalogEntry.appSortOrder,
    });
  }

  return features;
}

// Selects the route block from a catalog entry for the requested platform, or null when it doesn't publish there
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

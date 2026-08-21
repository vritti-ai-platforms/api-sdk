import { buildSiteCatalog, findFeatureByCode } from './catalog.builder';
import { buildDependsMap, filterGrantedByDeps } from './permission-deps';
import type {
  FeatureUnlocks,
  LockReason,
  PlatformBucket,
  ScopeType,
  ServiceCode,
  SiteFeatureLocks,
  SiteType,
  VersionSnapshot,
} from './types';
import { snapshotFeatureKey } from './types';

/**
 * The caller's surface, as the caller reports it.
 *
 * Finer than `PlatformBucket` on the mobile side — `ios` and `android` load different remote
 * entries but share one grant bucket. `app` is one-to-one with its bucket: an API client has no
 * variants because it has no UI.
 */
export type ClientPlatform = 'web' | 'ios' | 'android' | 'app';

/**
 * Stands in for the microfrontend an API client does not load.
 *
 * `PermissionFeature.route` is non-optional and read by the web sidebar and the mobile host to
 * mount a remote. Nothing on the app path reads it — the permission interceptor uses `code`,
 * `permissions` and `locked` — so an empty route keeps one shape for every bucket instead of
 * widening the field to null across every consumer.
 */
const EMPTY_ROUTE = { remoteEntry: '', exposedModule: '', routePrefix: '' };

export interface LockedPermission {
  code: string;
  reason: LockReason | null;
  unlockPlans: string[];
  missingServices: ServiceCode[];
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
  // Which declared services the org has not provisioned — empty unless lockReason is 'SERVICE'
  missingServices: ServiceCode[];
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
  // External services the org has provisioned; omitting it locks every service-dependent feature
  availableServices?: ServiceCode[];
}

// Resolves the features + MF config a user sees at a BU: plan ∧ BU catalog intersected with the role's grants, filtered to the requested platform
export function resolveUserFeatures(params: ResolveUserFeaturesParams): PermissionFeature[] {
  const { snapshot, businessCode, planCode, siteLocks, roleFeatures, platform, siteType, scope, availableServices } =
    params;

  // Plan unlocks, BU locks, and role grants are stored per platform; resolve only the requesting
  // surface's bucket (web → 'web'; ios/android → 'mobile'; app → 'app')
  const bucket: PlatformBucket = platform === 'web' ? 'web' : platform === 'app' ? 'app' : 'mobile';

  // Grants/plans/locks key features by bare code; resolve to the workspace scope's variant (or any variant when unscoped)
  const featureByCode = (code: string) =>
    scope ? snapshot.features?.[snapshotFeatureKey(code, scope)] : findFeatureByCode(snapshot, code);

  // Plan ∧ BU overlay for this bucket, filtered to features that apply to this workspace scope and node type — emits EVERY applicable business feature (plan non-members come out fully locked)
  const catalog = buildSiteCatalog(
    snapshot,
    businessCode,
    planCode,
    siteLocks,
    bucket,
    siteType,
    scope,
    availableServices,
  );
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
      const name = featureByCode(featureCode)?.name;
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

    // A UI bucket reaches its feature by loading a microfrontend, so a feature not published to
    // this platform is omitted rather than handed over as an unloadable tile. An API client loads
    // nothing — requiring a route there would make every headless feature permanently ungrantable.
    const route = bucket === 'app' ? EMPTY_ROUTE : pickRouteForPlatform(catalogEntry, platform);
    if (!route) continue;

    // Drop granted permissions whose intra-feature prerequisites aren't also granted (e.g. add needs view)
    const featureDeps = buildDependsMap(featureByCode(code)?.permissions ?? []);
    // Plan/BU lock a subset of permissions; surface which GRANTED ones are locked + why + how to unlock (upsell)
    const permByCode = new Map((catalogEntry.permissions ?? []).map((p) => [p.code, p]));
    const grantedPerms = [...filterGrantedByDeps(permsSet, featureDeps)];
    const lockedPermissions: LockedPermission[] = grantedPerms
      .map((c) => permByCode.get(c))
      .filter((p): p is NonNullable<typeof p> => !!p?.locked)
      .map((p) => ({
        code: p.code,
        reason: p.lockReason ?? null,
        unlockPlans: p.unlockPlans ?? [],
        missingServices: p.missingServices ?? [],
      }));

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
      missingServices: catalogEntry.missingServices ?? [],
      lockedPermissions,
      upsell,
      route,
      appCode: catalogEntry.appCode,
      appName: catalogEntry.appName,
      appIcon: catalogEntry.appIcon,
      appSortOrder: catalogEntry.appSortOrder,
    });
  }

  // Order app-alphabetically so the core-web sidebar (groups by app) renders apps sorted without any frontend re-sort;
  // stable sort keeps each app's features in their existing relative order
  features.sort((a, b) => a.appName.localeCompare(b.appName));

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

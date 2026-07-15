import { buildDependsMap, cascadeLocked, prereqClosure } from './permission-deps';
import type {
  ScopeType,
  SiteType,
  SiteFeatureLocks,
  CatalogPermission,
  FeatureCatalogEntry,
  LockReason,
  PlatformBucket,
  PlatformCodes,
  RoleItem,
  SnapshotFeature,
  SnapshotPlan,
  VersionSnapshot,
} from './types';
import { snapshotFeatureKey } from './types';

// Whether a feature with the given site-type applicability is exposed at this site type
export function featureAppliesAtNode(applicableSiteTypes: SiteType[], siteType: SiteType): boolean {
  return applicableSiteTypes.includes(siteType);
}

// Scope-agnostic lookup of a feature by bare code — grants/locks key features by code alone, so the first scope-variant's shared metadata (permission graph) answers
export function findFeatureByCode(snapshot: VersionSnapshot, code: string): SnapshotFeature | undefined {
  for (const feature of Object.values(snapshot.features ?? {})) {
    if (feature?.code === code) return feature;
  }
  return undefined;
}

// Builds the per-site catalog for ONE platform bucket — plan is the ceiling, siteLocks is a deny-list within it; each permission carries locked + lockReason + unlockPlans
export function buildSiteCatalog(
  snapshot: VersionSnapshot,
  businessCode: string | undefined,
  planCode: string | undefined,
  siteLocks: SiteFeatureLocks | undefined,
  bucket: PlatformBucket,
  siteType?: SiteType,
  scope?: ScopeType,
): FeatureCatalogEntry[] {
  if (!businessCode) return [];
  const business = snapshot.businesses?.[businessCode];
  if (!business) return [];
  const plan = planCode ? business.plans?.[planCode] : undefined;
  const plans = business.plans ?? {};

  const catalog: FeatureCatalogEntry[] = [];
  for (const app of business.apps) {
    // The app's renderable features (each ref pins scope+code to one app), dropped when they don't belong to this workspace scope or node type (outlet vs container)
    const businessAppFeatures = app.features
      .filter((ref) => scope === undefined || ref.scope === scope)
      .map((ref) => snapshot.features?.[snapshotFeatureKey(ref.code, ref.scope)])
      .filter(
        (f): f is SnapshotFeature =>
          !!f &&
          !!(f.microfrontends?.web || f.microfrontends?.mobile) &&
          (siteType === undefined || featureAppliesAtNode(f.applicableSiteTypes, siteType)),
      );

    if (businessAppFeatures.length === 0) continue;

    // Emit EVERY business feature so a role's grant on a plan-omitted feature still resolves as a locked tile instead of vanishing
    for (const feature of businessAppFeatures) {
      const membership = plan?.unlockedPermissions?.[feature.code];
      // Routes are exposed wherever the feature SHIPS — membership never hides them
      const web = feature.microfrontends?.web;
      const mobile = feature.microfrontends?.mobile;

      const permissions = buildPermissions(feature, businessCode, membership, siteLocks, plans, bucket);
      // Feature-level lock is EXPLICIT: plan must include the feature on this bucket and the site must not null-lock the platform
      const memberOnBucket = membership?.[bucket] !== undefined;
      const sitePlatformLocked = siteLocks?.[feature.code]?.[bucket] === null;
      const locked = !memberOnBucket || sitePlatformLocked;
      const lockReason: LockReason | null = !memberOnBucket ? 'PLAN' : sitePlatformLocked ? 'SITE' : null;
      const unlockPlans = lockReason === 'PLAN' ? plansIncludingFeature(plans, feature.code, bucket) : [];

      catalog.push({
        code: feature.code,
        name: feature.name,
        lucideIcon: feature.lucideIcon ?? null,
        sfSymbol: feature.sfSymbol ?? 'square',
        materialSymbol: feature.materialSymbol ?? 'square',
        web: web
          ? {
              remoteEntry: web.remoteEntry ?? '',
              exposedModule: web.exposedModule ?? '',
              routePrefix: web.routePrefix ?? '',
            }
          : null,
        mobile: mobile
          ? {
              remoteEntryAndroid: mobile.remoteEntryAndroid ?? '',
              remoteEntryIos: mobile.remoteEntryIos ?? '',
              exposedModule: mobile.exposedModule ?? '',
              routePrefix: mobile.routePrefix ?? '',
            }
          : null,
        appCode: app.code,
        appName: app.name,
        appIcon: app.icon ?? null,
        appSortOrder: app.sortOrder ?? 0,
        locked,
        lockReason,
        unlockPlans,
        permissions,
      });
    }
  }
  return catalog;
}

// A feature is a plan member when its unlock entry exists on at least one platform (even with zero actions)
export function isPlanMember(entry: PlatformCodes | undefined): boolean {
  return !!entry && (entry.web !== undefined || entry.mobile !== undefined);
}

// Per-platform site-lock primitive: null locks the whole feature, string[] locks those codes, absent = not locked
export function isSiteLockedOnPlatform(
  entry: SiteFeatureLocks[string] | undefined,
  platform: PlatformBucket,
  code: string,
): boolean {
  const locks = entry?.[platform];
  return locks === null || (locks?.includes(code) ?? false);
}

// A feature's business-scoped permissions, each tagged with locked + reason against the plan and site deny-list (bucket-scoped)
function buildPermissions(
  feature: SnapshotFeature,
  businessCode: string,
  planMembership: PlatformCodes | undefined,
  siteLocks: SiteFeatureLocks | undefined,
  plans: Record<string, SnapshotPlan>,
  bucket: PlatformBucket,
): CatalogPermission[] {
  const planUnlocked = new Set(planMembership?.[bucket] ?? []);
  const lockEntry = siteLocks?.[feature.code];

  const perms = (feature.permissions ?? []).filter((p) => p.isGlobal || p.businesses.includes(businessCode));
  const deps = buildDependsMap(perms);
  const codes = perms.map((p) => p.code);

  // Direct plan/site locks, then cascade so a locked prerequisite (e.g. view) locks its dependents (add/edit/delete)
  const directlyPlanLocked = new Set<string>();
  const directlySiteLocked = new Set<string>();
  for (const p of perms) {
    if (!planUnlocked.has(p.code)) directlyPlanLocked.add(p.code);
    if (isSiteLockedOnPlatform(lockEntry, bucket, p.code)) directlySiteLocked.add(p.code);
  }
  const directlyLocked = new Set<string>([...directlyPlanLocked, ...directlySiteLocked]);
  const lockedSet = cascadeLocked(codes, directlyLocked, deps);

  return perms.map((p) => {
    const locked = lockedSet.has(p.code);
    // A permission is enabled only if it AND its whole prerequisite closure are unlocked — reason/upsell reflect that
    const closure = [p.code, ...prereqClosure(p.code, deps)];
    const planReason = closure.some((c) => directlyPlanLocked.has(c));
    const siteReason = closure.some((c) => directlySiteLocked.has(c));
    // Plan is the ceiling, so a plan-lock anywhere in the closure wins over a site-lock when reporting the reason
    const lockReason: LockReason | null = !locked ? null : planReason ? 'PLAN' : siteReason ? 'SITE' : null;
    const unlockPlans =
      locked && lockReason === 'PLAN' ? plansUnlockingClosure(plans, feature.code, closure, bucket) : [];
    return { code: p.code, locked, lockReason, unlockPlans };
  });
}

// Plan codes (in the business) whose unlocked set includes the permission AND its whole prerequisite closure — upsell targets
function plansUnlockingClosure(
  plans: Record<string, SnapshotPlan>,
  featureCode: string,
  closure: string[],
  bucket: PlatformBucket,
): string[] {
  const result: string[] = [];
  for (const [code, plan] of Object.entries(plans)) {
    const unlocked = plan.unlockedPermissions?.[featureCode]?.[bucket];
    if (unlocked && closure.every((c) => unlocked.includes(c))) result.push(code);
  }
  return result;
}

// Plan codes (in the business) that include this feature on the bucket — the feature-level upsell targets
function plansIncludingFeature(
  plans: Record<string, SnapshotPlan>,
  featureCode: string,
  bucket: PlatformBucket,
): string[] {
  const result: string[] = [];
  for (const [code, plan] of Object.entries(plans)) {
    if (plan.unlockedPermissions?.[featureCode]?.[bucket] !== undefined) result.push(code);
  }
  return result;
}

// The business's role templates as provisionable role items for core (identical shapes)
export function buildSiteRoles(snapshot: VersionSnapshot, businessCode: string | undefined): RoleItem[] {
  if (!businessCode) return [];
  const business = snapshot.businesses?.[businessCode];
  if (!business) return [];
  return Object.values(business.roleTemplates ?? {});
}

import type {
  BuFeatureLocks,
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

// Builds the per-BU catalog for ONE platform bucket. The plan is the ceiling (membership + unlocks); buLocks is a
// deny-list within the plan (undefined or absent entries ⇒ fully available). Each permission carries
// locked + lockReason + unlockPlans, all evaluated against the requested bucket only.
export function buildBuCatalog(
  snapshot: VersionSnapshot,
  businessCode: string | undefined,
  planCode: string | undefined,
  buLocks: BuFeatureLocks | undefined,
  bucket: PlatformBucket,
): FeatureCatalogEntry[] {
  if (!businessCode) return [];
  const business = snapshot.businesses?.[businessCode];
  if (!business) return [];
  const plan = planCode ? business.plans?.[planCode] : undefined;
  const plans = business.plans ?? {};

  const catalog: FeatureCatalogEntry[] = [];
  for (const app of business.apps) {
    // The app's renderable features (each feature pins to exactly one app)
    const businessAppFeatures = app.features
      .map((code) => snapshot.features?.[code])
      .filter((f): f is SnapshotFeature => !!f && !!(f.microfrontends?.web || f.microfrontends?.mobile));

    if (businessAppFeatures.length === 0) continue;

    // Emit EVERY business feature so a role's grant on a plan-omitted feature still resolves (rendered as a locked
    // tile with an upsell) instead of vanishing. Core filters the catalog down to what the user's role grants.
    for (const feature of businessAppFeatures) {
      const membership = plan?.unlockedPermissions?.[feature.code];
      // Routes are exposed wherever the feature SHIPS — membership never hides them. A role grant on a
      // plan-omitted (feature or platform) still resolves as a locked tile with an upsell instead of vanishing.
      const web = feature.microfrontends?.web;
      const mobile = feature.microfrontends?.mobile;

      const permissions = buildPermissions(feature, businessCode, membership, buLocks, plans, bucket);
      // Feature-level lock is EXPLICIT, never derived from permission locks: the plan must include the feature
      // on this bucket (membership) and the BU must not null-lock the platform. Permission-code locks only
      // disable individual actions — the feature still renders (sidebar/tile stays enabled).
      const memberOnBucket = membership?.[bucket] !== undefined;
      const buPlatformLocked = buLocks?.[feature.code]?.[bucket] === null;
      const locked = !memberOnBucket || buPlatformLocked;
      const lockReason: LockReason | null = !memberOnBucket ? 'PLAN' : buPlatformLocked ? 'BU' : null;
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

// Per-platform BU-lock primitive: platform null locks the whole feature there; string[] locks those codes;
// entry/platform absent ⇒ not locked
export function isBuLockedOnPlatform(
  entry: BuFeatureLocks[string] | undefined,
  platform: PlatformBucket,
  code: string,
): boolean {
  const locks = entry?.[platform];
  return locks === null || (locks?.includes(code) ?? false);
}

// A feature's business-scoped permissions, each tagged with locked + reason against the plan and the BU deny-list.
// Everything is bucket-scoped: a web resolution ignores mobile unlocks and mobile locks entirely.
function buildPermissions(
  feature: SnapshotFeature,
  businessCode: string,
  planMembership: PlatformCodes | undefined,
  buLocks: BuFeatureLocks | undefined,
  plans: Record<string, SnapshotPlan>,
  bucket: PlatformBucket,
): CatalogPermission[] {
  const planUnlocked = new Set(planMembership?.[bucket] ?? []);
  const lockEntry = buLocks?.[feature.code];

  return (feature.permissions ?? [])
    .filter((p) => p.isGlobal || p.businesses.includes(businessCode))
    .map((p) => {
      const planAllows = planUnlocked.has(p.code);
      const buAllows = !isBuLockedOnPlatform(lockEntry, bucket, p.code);
      const locked = !planAllows || !buAllows;
      // Plan is the ceiling, so a plan-lock wins over a BU-lock when reporting the reason
      const lockReason: LockReason | null = !planAllows ? 'PLAN' : !buAllows ? 'BU' : null;
      const unlockPlans = lockReason === 'PLAN' ? plansUnlockingPermission(plans, feature.code, p.code, bucket) : [];
      return { code: p.code, locked, lockReason, unlockPlans };
    });
}

// Plan codes (in the business) whose unlocked set includes this feature+permission on the bucket — upsell targets
function plansUnlockingPermission(
  plans: Record<string, SnapshotPlan>,
  featureCode: string,
  permCode: string,
  bucket: PlatformBucket,
): string[] {
  const result: string[] = [];
  for (const [code, plan] of Object.entries(plans)) {
    if (plan.unlockedPermissions?.[featureCode]?.[bucket]?.includes(permCode)) result.push(code);
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
export function buildBuRoles(snapshot: VersionSnapshot, businessCode: string | undefined): RoleItem[] {
  if (!businessCode) return [];
  const business = snapshot.businesses?.[businessCode];
  if (!business) return [];
  return Object.values(business.roleTemplates ?? {});
}

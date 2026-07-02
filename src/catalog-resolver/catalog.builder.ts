import type {
  BuFeatureUnlocks,
  CatalogPermission,
  FeatureCatalogEntry,
  LockReason,
  RoleItem,
  SnapshotFeature,
  SnapshotPlan,
  VersionSnapshot,
} from './types';

// Builds the per-BU catalog. The plan is the ceiling (membership + unlocks); buUnlocks further restricts within
// the plan (undefined ⇒ inherit the full plan). Each permission carries locked + lockReason + unlockPlans (upsell).
export function buildBuCatalog(
  snapshot: VersionSnapshot,
  businessCode: string | undefined,
  planCode: string | undefined,
  buUnlocks?: BuFeatureUnlocks,
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
      const isMember = isPlanMember(membership);
      // Member: gate each platform's route by per-platform plan membership (member on web but not mobile → omit mobile).
      // Non-member (dormant): expose the route wherever the feature ships so it renders as a fully-locked tile.
      const web = isMember
        ? membership?.web !== undefined
          ? feature.microfrontends?.web
          : undefined
        : feature.microfrontends?.web;
      const mobile = isMember
        ? membership?.mobile !== undefined
          ? feature.microfrontends?.mobile
          : undefined
        : feature.microfrontends?.mobile;

      const permissions = buildPermissions(feature, businessCode, membership, buUnlocks, plans);
      const locked = permissions.length === 0 ? true : permissions.every((p) => p.locked);
      // Feature reason: all locked-by-BU ⇒ BU; otherwise PLAN. Unlock plans only meaningful for plan-locks.
      const lockReason: LockReason | null = !locked
        ? null
        : permissions.length > 0 && permissions.every((p) => p.lockReason === 'BU')
          ? 'BU'
          : 'PLAN';
      const unlockPlans = locked && lockReason === 'PLAN' ? plansIncludingFeature(plans, feature.code) : [];

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
export function isPlanMember(entry: { web?: string[]; mobile?: string[] } | undefined): boolean {
  return !!entry && (entry.web !== undefined || entry.mobile !== undefined);
}

// Flattens a feature's per-platform unlock entry into the union of unlocked permission codes
export function unlockedCodes(entry: { web?: string[]; mobile?: string[] } | undefined): string[] {
  if (!entry) return [];
  return [...new Set([...(entry.web ?? []), ...(entry.mobile ?? [])])];
}

// A feature's business-scoped permissions, each tagged with locked + reason against the plan and the BU allow-set.
function buildPermissions(
  feature: SnapshotFeature,
  businessCode: string,
  planMembership: { web?: string[]; mobile?: string[] } | undefined,
  buUnlocks: BuFeatureUnlocks | undefined,
  plans: Record<string, SnapshotPlan>,
): CatalogPermission[] {
  const planUnlocked = new Set(unlockedCodes(planMembership));
  // undefined buUnlocks ⇒ BU inherits the plan (no restriction); else the feature's BU allow-set (absent ⇒ none)
  const buUnlocked = buUnlocks === undefined ? null : new Set(unlockedCodes(buUnlocks[feature.code]));

  return (feature.permissions ?? [])
    .filter((p) => p.isGlobal || p.businesses.includes(businessCode))
    .map((p) => {
      const planAllows = planUnlocked.has(p.code);
      const buAllows = buUnlocked === null ? true : buUnlocked.has(p.code);
      const locked = !planAllows || !buAllows;
      // Plan is the ceiling, so a plan-lock wins over a BU-lock when reporting the reason
      const lockReason: LockReason | null = !planAllows ? 'PLAN' : !buAllows ? 'BU' : null;
      const unlockPlans = lockReason === 'PLAN' ? plansUnlockingPermission(plans, feature.code, p.code) : [];
      return { code: p.code, locked, lockReason, unlockPlans };
    });
}

// Plan codes (in the business) whose unlocked set includes this feature+permission — the upsell targets
function plansUnlockingPermission(
  plans: Record<string, SnapshotPlan>,
  featureCode: string,
  permCode: string,
): string[] {
  const result: string[] = [];
  for (const [code, plan] of Object.entries(plans)) {
    if (unlockedCodes(plan.unlockedPermissions?.[featureCode]).includes(permCode)) result.push(code);
  }
  return result;
}

// Plan codes (in the business) that include this feature at all (membership) — the feature-level upsell targets
function plansIncludingFeature(plans: Record<string, SnapshotPlan>, featureCode: string): string[] {
  const result: string[] = [];
  for (const [code, plan] of Object.entries(plans)) {
    if (isPlanMember(plan.unlockedPermissions?.[featureCode])) result.push(code);
  }
  return result;
}

// Maps the business's role templates into provisionable role items for core (global grants)
export function buildBuRoles(snapshot: VersionSnapshot, businessCode: string | undefined): RoleItem[] {
  if (!businessCode) return [];
  const business = snapshot.businesses?.[businessCode];
  if (!business) return [];
  return business.roleTemplates.map((r) => ({
    name: r.name,
    code: r.code,
    features: r.features,
  }));
}

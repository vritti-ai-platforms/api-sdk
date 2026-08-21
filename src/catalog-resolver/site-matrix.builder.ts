import { featureAppliesAtNode, isPlanMember, isSiteLockedOnPlatform, normalizeApiBuckets } from './catalog.builder';
import {
  API_BUCKETS,
  type ApiSurface,
  type PlatformBucket,
  type ScopeType,
  type SiteFeatureLocks,
  type SiteType,
  type SnapshotPlan,
  SURFACE_BY_BUCKET,
  snapshotFeatureKey,
  UI_PLATFORMS,
  type VersionSnapshot,
} from './types';

export interface SiteMatrixCell {
  inPlan: boolean;
  selected: boolean;
  availableIn: string[];
}

export interface SiteMatrixPermission {
  code: string;
  label: string;
  dependsOn: string[];
  web: SiteMatrixCell | null;
  mobile: SiteMatrixCell | null;
  graphql: SiteMatrixCell | null;
  http: SiteMatrixCell | null;
}

export interface SiteMatrixFeature {
  code: string;
  name: string;
  icon: string | null;
  scope: ScopeType;
  applicableSiteTypes: SiteType[];
  platforms: PlatformBucket[];
  inPlan: boolean;
  availableIn: string[];
  // The API surfaces the feature declares — what lets the app-credential editor filter by the
  // credential's type. Absent on pre-flag snapshots, which reads as "any surface".
  apiSurfaces?: ApiSurface[];
  permissions: SiteMatrixPermission[];
}

export interface SiteMatrixApp {
  code: string;
  name: string;
  icon: string | null;
  unlockedCount: number;
  totalCount: number;
  features: SiteMatrixFeature[];
}

export interface SiteMatrix {
  plan: { code: string; name: string };
  apps: SiteMatrixApp[];
  locks: SiteFeatureLocks;
}

// Builds the SITE-only apps/features/permissions matrix — not filtered to plan members; plan-locked items carry inPlan=false + availableIn
export function buildSiteMatrix(
  snapshot: VersionSnapshot,
  businessCode: string | undefined,
  planCode: string | undefined,
  siteLocks: SiteFeatureLocks | undefined,
  siteType?: SiteType,
): SiteMatrix {
  return buildMatrix(snapshot, businessCode, planCode, siteLocks, false, siteType);
}

// Builds the all-scopes apps/features/permissions matrix — every scope's features included, each carrying its real scope; powers the Plan Overview + Create Custom Role picker
export function buildPlanMatrix(
  snapshot: VersionSnapshot,
  businessCode: string | undefined,
  planCode: string | undefined,
  siteLocks?: SiteFeatureLocks,
): SiteMatrix {
  return buildMatrix(snapshot, businessCode, planCode, siteLocks, true);
}

// Shared matrix builder — allScopes=false keeps only SITE refs; allScopes=true includes every scope and emits each feature's real scope
function buildMatrix(
  snapshot: VersionSnapshot,
  businessCode: string | undefined,
  planCode: string | undefined,
  siteLocks: SiteFeatureLocks | undefined,
  allScopes: boolean,
  siteType?: SiteType,
): SiteMatrix {
  const business = businessCode ? snapshot.businesses?.[businessCode] : undefined;
  // Legacy `app` buckets in stored documents read as both API surfaces — see normalizeApiBuckets
  const plans = Object.fromEntries(
    Object.entries(business?.plans ?? {}).map(([code, p]) => [
      code,
      { ...p, unlockedPermissions: normalizeApiBuckets(p.unlockedPermissions) ?? {} },
    ]),
  );
  const plan = planCode ? plans[planCode] : undefined;
  const planMeta = { code: planCode ?? '', name: plan?.name ?? planCode ?? '' };
  const normalizedLocks = normalizeApiBuckets(siteLocks);
  const locks = normalizedLocks ?? {};
  if (!business || !plan) return { plan: planMeta, apps: [], locks };

  const apps: SiteMatrixApp[] = [];
  for (const app of business.apps) {
    let unlockedCount = 0;
    let totalCount = 0;
    const features: SiteMatrixFeature[] = [];

    for (const ref of app.features) {
      if (!allScopes && ref.scope !== 'SITE') continue;
      const code = ref.code;
      const feature = snapshot.features?.[snapshotFeatureKey(code, ref.scope)];
      if (!feature) continue;
      if (siteType !== undefined && !featureAppliesAtNode(feature.applicableSiteTypes, siteType)) continue;
      // A UI bucket is offered only where the feature publishes a microfrontend; each API bucket is
      // offered where the feature declares its surface. An undeclared list (pre-flag snapshot) keeps
      // the old always-offered behaviour on both; an undeclared surface shows an em dash like a
      // missing microfrontend does.
      const platforms: PlatformBucket[] = [
        ...UI_PLATFORMS.filter((p) => !!feature.microfrontends?.[p]),
        ...API_BUCKETS.filter(
          (b) => feature.apiSurfaces === undefined || feature.apiSurfaces.includes(SURFACE_BY_BUCKET[b]),
        ),
      ];

      const membership = plan.unlockedPermissions?.[code];
      const featureInPlan = isPlanMember(membership);
      const siteEntry = normalizedLocks?.[code];

      const permissions: SiteMatrixPermission[] = (feature.permissions ?? [])
        .filter((p) => p.isGlobal || p.businesses.includes(businessCode ?? ''))
        .map((p) => {
          const cell = (plat: PlatformBucket): SiteMatrixCell | null => {
            if (!platforms.includes(plat)) return null;
            const planCodes = membership?.[plat];
            const inPlan = featureInPlan && planCodes !== undefined && planCodes.includes(p.code);
            // Deny-list: an in-plan cell is selected unless the site locks it on this platform
            const selected = inPlan && !isSiteLockedOnPlatform(siteEntry, plat, p.code);
            const availableIn = inPlan ? [] : plansUnlockingPerm(plans, code, p.code, plat, planCode);
            totalCount += 1;
            if (inPlan) unlockedCount += 1;
            return { inPlan, selected, availableIn };
          };
          return {
            code: p.code,
            label: p.label,
            dependsOn: p.dependsOn ?? [],
            web: cell('web'),
            mobile: cell('mobile'),
            graphql: cell('graphql'),
            http: cell('http'),
          };
        });

      features.push({
        code: feature.code,
        name: feature.name,
        icon: feature.lucideIcon ?? null,
        scope: feature.scope,
        applicableSiteTypes: feature.applicableSiteTypes,
        platforms,
        inPlan: featureInPlan,
        availableIn: featureInPlan ? [] : plansIncludingFeature(plans, code, planCode),
        apiSurfaces: feature.apiSurfaces,
        permissions,
      });
    }

    if (features.length === 0) continue;
    apps.push({ code: app.code, name: app.name, icon: app.icon ?? null, unlockedCount, totalCount, features });
  }

  // Emit apps alphabetically by name so every consumer (Plan Overview, Role picker, all Locks screens) renders them sorted
  apps.sort((a, b) => a.name.localeCompare(b.name));

  return { plan: planMeta, apps, locks };
}

// Names of other plans (excluding the org's own) that unlock this feature+permission on the given platform
function plansUnlockingPerm(
  plans: Record<string, SnapshotPlan>,
  featureCode: string,
  permCode: string,
  platform: PlatformBucket,
  excludeCode: string | undefined,
): string[] {
  const names: string[] = [];
  for (const [code, p] of Object.entries(plans)) {
    if (code === excludeCode) continue;
    if ((p.unlockedPermissions?.[featureCode]?.[platform] ?? []).includes(permCode)) names.push(p.name);
  }
  return names;
}

// Names of other plans (excluding the org's own) that include this feature at all (membership) — feature-level upsell
function plansIncludingFeature(
  plans: Record<string, SnapshotPlan>,
  featureCode: string,
  excludeCode: string | undefined,
): string[] {
  const names: string[] = [];
  for (const [code, p] of Object.entries(plans)) {
    if (code === excludeCode) continue;
    if (isPlanMember(p.unlockedPermissions?.[featureCode])) names.push(p.name);
  }
  return names;
}

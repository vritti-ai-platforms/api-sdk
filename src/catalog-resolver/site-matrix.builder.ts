import { featureAppliesAtNode, isPlanMember, isSiteLockedOnPlatform } from './catalog.builder';
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
  // credential's type.
  apiSurfaces: ApiSurface[];
  permissions: SiteMatrixPermission[];
}

export interface MatrixCounts {
  unlocked: number;
  total: number;
}

export interface SiteMatrixApp {
  code: string;
  name: string;
  icon: string | null;
  // Counted per surface, not as one total: a consumer showing a subset of the columns (the
  // app-credential editor shows exactly one) sums the surfaces it renders. One number covering all
  // four read as "20/20 unlocked" above the 5 checkboxes actually on screen.
  counts: Record<PlatformBucket, MatrixCounts>;
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
  const business = businessCode ? snapshot.businesses[businessCode] : undefined;
  const plans = business?.plans ?? {};
  const plan = planCode ? plans[planCode] : undefined;
  const planMeta = { code: planCode ?? '', name: plan?.name ?? planCode ?? '' };
  const locks = siteLocks ?? {};
  if (!business || !plan) return { plan: planMeta, apps: [], locks };

  const apps: SiteMatrixApp[] = [];
  for (const app of business.apps) {
    const counts: Record<PlatformBucket, MatrixCounts> = {
      web: { unlocked: 0, total: 0 },
      mobile: { unlocked: 0, total: 0 },
      graphql: { unlocked: 0, total: 0 },
      http: { unlocked: 0, total: 0 },
    };
    const features: SiteMatrixFeature[] = [];

    for (const ref of app.features) {
      if (!allScopes && ref.scope !== 'SITE') continue;
      const code = ref.code;
      const feature = snapshot.features[snapshotFeatureKey(code, ref.scope)];
      if (!feature) continue;
      if (siteType !== undefined && !featureAppliesAtNode(feature.applicableSiteTypes, siteType)) continue;
      // A UI bucket is offered only where the feature publishes a microfrontend; each API bucket is
      // offered where the feature declares its surface. An undeclared surface shows an em dash like
      // a missing microfrontend does.
      const platforms: PlatformBucket[] = [
        ...UI_PLATFORMS.filter((p) => !!feature.microfrontends?.[p]),
        ...API_BUCKETS.filter((b) => feature.apiSurfaces.includes(SURFACE_BY_BUCKET[b])),
      ];

      const groupByCode = new Map(feature.permissionGroups.map((g) => [g.code, g]));
      const membership = plan.unlockedPermissions[code];
      const featureInPlan = isPlanMember(membership);
      const siteEntry = siteLocks?.[code];

      const permissions: SiteMatrixPermission[] = feature.permissions
        .filter((p) => p.isGlobal || p.businesses.includes(businessCode ?? ''))
        .map((p) => {
          const cell = (plat: PlatformBucket): SiteMatrixCell | null => {
            // The feature must reach this bucket AND this code must be implemented on it — the same
            // two gates buildSiteCatalog applies, so the matrix and the catalog cannot disagree
            if (!platforms.includes(plat) || !p.platforms.includes(plat)) return null;
            const planCodes = membership?.[plat];
            const inPlan = featureInPlan && planCodes !== undefined && planCodes.includes(p.code);
            // Deny-list: an in-plan cell is selected unless the site locks it on this platform
            const selected = inPlan && !isSiteLockedOnPlatform(siteEntry, plat, p.code);
            const availableIn = inPlan ? [] : plansUnlockingPerm(plans, code, p.code, plat, planCode);
            counts[plat].total += 1;
            if (inPlan) counts[plat].unlocked += 1;
            return { inPlan, selected, availableIn };
          };
          return {
            code: p.code,
            label: p.label,
            dependsOn: p.dependsOn,
            group: p.group ? groupByCode.get(p.group) : undefined,
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
    apps.push({ code: app.code, name: app.name, icon: app.icon ?? null, counts, features });
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
    if ((p.unlockedPermissions[featureCode]?.[platform] ?? []).includes(permCode)) names.push(p.name);
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
    if (isPlanMember(p.unlockedPermissions[featureCode])) names.push(p.name);
  }
  return names;
}

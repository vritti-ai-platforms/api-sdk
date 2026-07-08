import { isBuLockedOnPlatform, isPlanMember } from './catalog.builder';
import { type BuFeatureLocks, PLATFORMS, type PlatformBucket, type SnapshotPlan, type VersionSnapshot } from './types';

export interface BuMatrixCell {
  inPlan: boolean;
  selected: boolean;
  availableIn: string[];
}

export interface BuMatrixPermission {
  code: string;
  label: string;
  dependsOn: string[];
  web: BuMatrixCell | null;
  mobile: BuMatrixCell | null;
}

export interface BuMatrixFeature {
  code: string;
  name: string;
  icon: string | null;
  platforms: PlatformBucket[];
  inPlan: boolean;
  availableIn: string[];
  permissions: BuMatrixPermission[];
}

export interface BuMatrixApp {
  code: string;
  name: string;
  icon: string | null;
  unlockedCount: number;
  totalCount: number;
  features: BuMatrixFeature[];
}

export interface BuMatrix {
  plan: { code: string; name: string };
  apps: BuMatrixApp[];
  locks: BuFeatureLocks;
}

// Builds the full apps/features/permissions matrix from the snapshot — not filtered to plan members; plan-locked items carry inPlan=false + availableIn
export function buildBuMatrix(
  snapshot: VersionSnapshot,
  businessCode: string | undefined,
  planCode: string | undefined,
  buLocks: BuFeatureLocks | undefined,
): BuMatrix {
  const business = businessCode ? snapshot.businesses?.[businessCode] : undefined;
  const plans = business?.plans ?? {};
  const plan = planCode ? plans[planCode] : undefined;
  const planMeta = { code: planCode ?? '', name: plan?.name ?? planCode ?? '' };
  const locks = buLocks ?? {};
  if (!business || !plan) return { plan: planMeta, apps: [], locks };

  const apps: BuMatrixApp[] = [];
  for (const app of business.apps) {
    let unlockedCount = 0;
    let totalCount = 0;
    const features: BuMatrixFeature[] = [];

    for (const code of app.features) {
      const feature = snapshot.features?.[code];
      if (!feature) continue;
      const platforms = PLATFORMS.filter((p) => !!feature.microfrontends?.[p]);
      if (platforms.length === 0) continue;

      const membership = plan.unlockedPermissions?.[code];
      const featureInPlan = isPlanMember(membership);
      const buEntry = buLocks?.[code];

      const permissions: BuMatrixPermission[] = (feature.permissions ?? [])
        .filter((p) => p.isGlobal || p.businesses.includes(businessCode ?? ''))
        .map((p) => {
          const cell = (plat: PlatformBucket): BuMatrixCell | null => {
            if (!platforms.includes(plat)) return null;
            const planCodes = membership?.[plat];
            const inPlan = featureInPlan && planCodes !== undefined && planCodes.includes(p.code);
            // Deny-list: an in-plan cell is selected unless the BU locks it on this platform
            const selected = inPlan && !isBuLockedOnPlatform(buEntry, plat, p.code);
            const availableIn = inPlan ? [] : plansUnlockingPerm(plans, code, p.code, plat, planCode);
            totalCount += 1;
            if (inPlan) unlockedCount += 1;
            return { inPlan, selected, availableIn };
          };
          return { code: p.code, label: p.label, dependsOn: p.dependsOn ?? [], web: cell('web'), mobile: cell('mobile') };
        });

      features.push({
        code: feature.code,
        name: feature.name,
        icon: feature.lucideIcon ?? null,
        platforms,
        inPlan: featureInPlan,
        availableIn: featureInPlan ? [] : plansIncludingFeature(plans, code, planCode),
        permissions,
      });
    }

    apps.push({ code: app.code, name: app.name, icon: app.icon ?? null, unlockedCount, totalCount, features });
  }

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

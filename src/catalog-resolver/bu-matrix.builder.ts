import { isBuLockedOnPlatform, isPlanMember } from './catalog.builder';
import type { BuFeatureLocks, SnapshotPlan, VersionSnapshot } from './types';

// UI platform keys — the snapshot's microfrontend keys (lowercase), not the storage AppPlatform enum
type Platform = 'web' | 'mobile';
const PLATFORMS: Platform[] = ['web', 'mobile'];

// A single (permission, platform) cell. null ⇒ the feature doesn't ship on that platform.
export interface BuMatrixCell {
  inPlan: boolean; // the org's plan unlocks this (feature, platform, permission)
  selected: boolean; // the BU currently has it enabled (never true when !inPlan)
  availableIn: string[]; // other plan names that unlock it — upsell; only when !inPlan
}

export interface BuMatrixPermission {
  code: string;
  label: string;
  web: BuMatrixCell | null;
  mobile: BuMatrixCell | null;
}

export interface BuMatrixFeature {
  code: string;
  name: string;
  icon: string | null;
  platforms: Platform[]; // platforms the feature ships on
  inPlan: boolean; // FEATURE-level: is this feature a member of the org's plan at all?
  availableIn: string[]; // plans that include the feature — upsell when !inPlan
  permissions: BuMatrixPermission[];
}

export interface BuMatrixApp {
  code: string;
  name: string;
  icon: string | null;
  unlockedCount: number; // (feature × platform × permission) cells the plan unlocks
  totalCount: number; // all possible cells in this app
  features: BuMatrixFeature[];
}

export interface BuMatrix {
  plan: { code: string; name: string };
  apps: BuMatrixApp[];
}

// Builds the full apps/features/permissions matrix from the version snapshot — NOT filtered to plan members.
// Every app/feature/permission renders; plan-locked items carry inPlan=false + availableIn (the upsell plans).
// buLocks layers the BU's deny-list within the plan (undefined or absent entries ⇒ the full plan is selected).
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
  if (!business || !plan) return { plan: planMeta, apps: [] };

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
          const cell = (plat: Platform): BuMatrixCell | null => {
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
          return { code: p.code, label: p.label, web: cell('web'), mobile: cell('mobile') };
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

  return { plan: planMeta, apps };
}

// Names of other plans (excluding the org's own) that unlock this feature+permission on the given platform
function plansUnlockingPerm(
  plans: Record<string, SnapshotPlan>,
  featureCode: string,
  permCode: string,
  platform: Platform,
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

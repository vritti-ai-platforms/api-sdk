// Output document shape — what gets stored in versions.snapshot
export interface SnapshotPermission {
  code: string;
  label: string;
  isGlobal: boolean;
  businesses: string[];
}
// WEB microfrontend route — a single remote entry. All non-null: a WEB microfrontend row is
// CHECK-constrained to have remoteEntry set, and the feature↔MF link's module/route are NOT NULL.
export interface SnapshotMicrofrontendWeb {
  code: string;
  name: string;
  remoteEntry: string;
  exposedModule: string;
  routePrefix: string;
}
// MOBILE microfrontend route — per-OS remote entries (android + ios). All non-null: a MOBILE row is
// CHECK-constrained to have both android + ios set, and the link's module/route are NOT NULL.
export interface SnapshotMicrofrontendMobile {
  code: string;
  name: string;
  remoteEntryAndroid: string;
  remoteEntryIos: string;
  exposedModule: string;
  routePrefix: string;
}
// Per-platform microfrontend routes — mirrors the {web?, mobile?} shape used by role grants / plan unlocks.
export interface SnapshotMicrofrontends {
  web?: SnapshotMicrofrontendWeb;
  mobile?: SnapshotMicrofrontendMobile;
}
export interface SnapshotFeature {
  code: string;
  name: string;
  lucideIcon: string;
  sfSymbol: string;
  materialSymbol: string;
  permissions: SnapshotPermission[];
  microfrontends: SnapshotMicrofrontends;
}
export interface SnapshotApp {
  code: string;
  name: string;
  icon: string;
  sortOrder: number;
  features: string[];
}
export interface SnapshotRoleTemplate {
  name: string;
  // Stable link to provisioned org roles (the template's code, not its id)
  code: string;
  // featureCode -> { app: appCode, web?: [permCode…], mobile?: [permCode…] } — grants split per platform, app stamped
  features: Record<string, { app: string; web?: string[]; mobile?: string[] }>;
}
// A plan is a lock overlay: the feature-permissions it UNLOCKS per platform (everything else renders locked).
// Apps are derived from these. Shape mirrors role grants: featureCode -> { web?: [permCode…], mobile?: [permCode…] }.
export interface SnapshotPlan {
  code: string;
  name: string;
  isCustom: boolean;
  maxBusinessUnits: number | null;
  unlockedPermissions: Record<string, { web?: string[]; mobile?: string[] }>;
}
export interface SnapshotBusiness {
  name: string;
  apps: SnapshotApp[];
  roleTemplates: SnapshotRoleTemplate[];
  plans: Record<string, SnapshotPlan>;
}
export interface VersionSnapshot {
  features: Record<string, SnapshotFeature>;
  businesses: Record<string, SnapshotBusiness>;
}

// Why a permission/feature is locked: PLAN (org's plan doesn't unlock it) or BU (this BU restricts it)
export type LockReason = 'PLAN' | 'BU';

// BU deny-list: platform null locks the whole feature on that platform; string[] locks those codes;
// feature/platform absent = fully available within the plan
export type BuFeatureLocks = Record<string, { web?: string[] | null; mobile?: string[] | null }>;

// A catalog permission: its lock state + reason + (when plan-locked) the plans that would unlock it (upsell)
export interface CatalogPermission {
  code: string;
  locked: boolean;
  lockReason: LockReason | null;
  unlockPlans: string[];
}

// Mirrors core-server's business_units.featureCatalog entry shape exactly
export interface FeatureCatalogEntry {
  code: string;
  name: string;
  lucideIcon: string | null;
  sfSymbol: string;
  materialSymbol: string;
  // Per-platform MF route — symmetric { web?, mobile? }; null when the feature has no MF for that platform.
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
  appCode: string;
  appName: string;
  appIcon: string | null;
  appSortOrder: number;
  // Feature-level lock is explicit — plan non-membership or a BU whole-platform lock (never derived from
  // permission-code locks, which only disable individual actions)
  locked: boolean;
  lockReason: LockReason | null;
  // Plans (in the business) that would unlock the feature when it's plan-locked — for upsell
  unlockPlans: string[];
  permissions: CatalogPermission[];
}

// Role template pushed to core for provisioning (matches core RoleItemDto)
export interface RoleItem {
  name: string;
  // Stable link to the provisioned org role (the template's code) — also marks it as a read-only default role
  code: string;
  // featureCode -> { app: appCode, web?: [permCode…], mobile?: [permCode…] }
  features: Record<string, { app: string; web?: string[]; mobile?: string[] }>;
}

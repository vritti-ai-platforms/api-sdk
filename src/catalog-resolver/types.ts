// ——— Platform algebra ———
// Everything in this domain (plan unlocks, role grants, BU locks) is stored per UI platform bucket.

export type PlatformBucket = 'web' | 'mobile';

export const PLATFORMS: PlatformBucket[] = ['web', 'mobile'];

// Allow entry: a bucket key present (even []) = membership on that platform; the array holds permission codes
export interface PlatformCodes {
  web?: string[];
  mobile?: string[];
}

// Deny entry: null locks/revokes the whole bucket, string[] the listed codes, absent = untouched
export interface PlatformDenyCodes {
  web?: string[] | null;
  mobile?: string[] | null;
}

// Code-keyed allow-list — plan unlocks, role grants, and matrix selections all share this exact shape
export type FeatureUnlocks = Record<string, PlatformCodes>;

// BU deny-list overlay (same shape as role revokes) — feature absent = fully available within the plan
export type BuFeatureLocks = Record<string, PlatformDenyCodes>;

// ——— Snapshot document shape — what gets stored in versions.snapshot and signed into the catalog license ———

export interface SnapshotPermission {
  code: string;
  label: string;
  isGlobal: boolean;
  businesses: string[];
  // Direct intra-feature prerequisite codes (e.g. add -> [view]); empty = root. Transitive closure via recursion.
  dependsOn: string[];
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
// Per-platform microfrontend routes — mirrors the PlatformCodes {web?, mobile?} bucket shape
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
// Also the shape provisioned to core as a role stub (the template's code is the durable org-role link)
export interface SnapshotRoleTemplate {
  name: string;
  code: string;
  // featureCode -> per-platform granted permission codes
  features: FeatureUnlocks;
}
// A plan is a lock overlay: the feature-permissions it UNLOCKS per platform (everything else renders locked).
// Apps are derived from these.
export interface SnapshotPlan {
  code: string;
  name: string;
  isCustom: boolean;
  maxBusinessUnits: number | null;
  unlockedPermissions: FeatureUnlocks;
}
export interface SnapshotBusiness {
  name: string;
  apps: SnapshotApp[];
  // Keyed by template code — the same key org roles link to
  roleTemplates: Record<string, SnapshotRoleTemplate>;
  plans: Record<string, SnapshotPlan>;
}
export interface VersionSnapshot {
  // Shape revision hook for future migrations (absent = pre-versioned snapshots)
  schemaVersion?: number;
  features: Record<string, SnapshotFeature>;
  businesses: Record<string, SnapshotBusiness>;
}

// The current snapshot shape revision written by the cloud snapshot builder
export const SNAPSHOT_SCHEMA_VERSION = 1;

// Why a permission/feature is locked: PLAN (org's plan doesn't unlock it) or BU (this BU restricts it)
export type LockReason = 'PLAN' | 'BU';

// A catalog permission: its lock state + reason + (when plan-locked) the plans that would unlock it (upsell)
export interface CatalogPermission {
  code: string;
  locked: boolean;
  lockReason: LockReason | null;
  unlockPlans: string[];
}

// One resolved feature of the per-BU catalog
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

// Role template pushed to core for provisioning — identical to the snapshot template shape
export type RoleItem = SnapshotRoleTemplate;

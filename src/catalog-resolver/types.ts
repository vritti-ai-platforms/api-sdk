// ——— Platform algebra — plan unlocks, role grants, and BU locks are all stored per UI platform bucket ———

export type PlatformBucket = 'web' | 'mobile';

export const PLATFORMS: PlatformBucket[] = ['web', 'mobile'];

export interface PlatformCodes {
  web?: string[];
  mobile?: string[];
}

export interface PlatformDenyCodes {
  web?: string[] | null;
  mobile?: string[] | null;
}

export type FeatureUnlocks = Record<string, PlatformCodes>;

export type BuFeatureLocks = Record<string, PlatformDenyCodes>;

// ——— Snapshot document shape — what gets stored in versions.snapshot and signed into the catalog license ———

export interface SnapshotPermission {
  code: string;
  label: string;
  isGlobal: boolean;
  businesses: string[];
  dependsOn: string[];
}
export interface SnapshotMicrofrontendWeb {
  code: string;
  name: string;
  remoteEntry: string;
  exposedModule: string;
  routePrefix: string;
}
export interface SnapshotMicrofrontendMobile {
  code: string;
  name: string;
  remoteEntryAndroid: string;
  remoteEntryIos: string;
  exposedModule: string;
  routePrefix: string;
}
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
  code: string;
  features: FeatureUnlocks;
}
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
  roleTemplates: Record<string, SnapshotRoleTemplate>;
  plans: Record<string, SnapshotPlan>;
}
export interface VersionSnapshot {
  schemaVersion?: number;
  features: Record<string, SnapshotFeature>;
  businesses: Record<string, SnapshotBusiness>;
}

export const SNAPSHOT_SCHEMA_VERSION = 1;

export type LockReason = 'PLAN' | 'BU';

export interface CatalogPermission {
  code: string;
  locked: boolean;
  lockReason: LockReason | null;
  unlockPlans: string[];
}

export interface FeatureCatalogEntry {
  code: string;
  name: string;
  lucideIcon: string | null;
  sfSymbol: string;
  materialSymbol: string;
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
  locked: boolean;
  lockReason: LockReason | null;
  unlockPlans: string[];
  permissions: CatalogPermission[];
}

export type RoleItem = SnapshotRoleTemplate;

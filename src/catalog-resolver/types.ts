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

export type FeatureLocks = Record<string, PlatformDenyCodes>;
export type SiteFeatureLocks = FeatureLocks;

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
export type ScopeType = 'ORG' | 'LE' | 'SITE_GROUP' | 'SITE';
export type SiteType = 'OUTLET' | 'WAREHOUSE' | 'PRODUCTION';
export const SITE_TYPES: SiteType[] = ['OUTLET', 'WAREHOUSE', 'PRODUCTION'];
export interface SnapshotFeature {
  code: string;
  name: string;
  lucideIcon: string;
  sfSymbol: string;
  materialSymbol: string;
  scope: ScopeType;
  applicableSiteTypes: SiteType[];
  permissions: SnapshotPermission[];
  microfrontends: SnapshotMicrofrontends;
}
export interface SnapshotAppFeatureRef {
  code: string;
  scope: ScopeType;
}
export interface SnapshotApp {
  code: string;
  name: string;
  icon: string;
  sortOrder: number;
  features: SnapshotAppFeatureRef[];
}
export interface SnapshotRoleTemplate {
  name: string;
  code: string;
  scope: ScopeType;
  siteType: SiteType;
  features: FeatureUnlocks;
}
export interface SnapshotPlan {
  code: string;
  name: string;
  isCustom: boolean;
  maxSites: number | null;
  unlockedPermissions: FeatureUnlocks;
}
export interface VocabularyEntry {
  singular: string;
  plural: string;
}
export interface BusinessVocabulary {
  site?: VocabularyEntry;
  siteGroup?: VocabularyEntry;
  outlet?: VocabularyEntry;
  warehouse?: VocabularyEntry;
  production?: VocabularyEntry;
}
export interface SnapshotBusiness {
  name: string;
  vocabulary?: BusinessVocabulary;
  apps: SnapshotApp[];
  roleTemplates: Record<string, SnapshotRoleTemplate>;
  plans: Record<string, SnapshotPlan>;
}
export interface VersionSnapshot {
  schemaVersion?: number;
  // Flat feature dictionary keyed by `${scope}.${code}` (see snapshotFeatureKey) — same-code features at different scopes stay distinct
  features: Record<string, SnapshotFeature>;
  businesses: Record<string, SnapshotBusiness>;
}

// Composite key for the snapshot feature dictionary — feature identity is (scope, code)
export function snapshotFeatureKey(code: string, scope: ScopeType): string {
  return `${scope}.${code}`;
}

export const SNAPSHOT_SCHEMA_VERSION = 2;

export type LockReason = 'PLAN' | 'SITE';

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

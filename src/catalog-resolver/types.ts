// ——— Platform algebra — plan unlocks, role grants, and BU locks are all stored per platform bucket ———

/**
 * The surfaces a permission can be granted on.
 *
 * `web` and `mobile` are UI buckets: a feature reaches them through a microfrontend, and a grant
 * there means a person can operate it on that surface. `graphql` and `http` are not UIs at all —
 * each is an API surface a credential signs its own requests against, so they have no
 * microfrontend and no route, and a feature needs neither to be reachable on one.
 *
 * Keeping the API buckets in the same algebra rather than beside it is what lets plan entitlement,
 * node feature locks and permission prerequisites bind an API client exactly as they bind a person.
 * One bucket per surface is what lets a plan entitle GraphQL and HTTP access independently.
 */
export type PlatformBucket = 'web' | 'mobile' | 'graphql' | 'http';

export const PLATFORMS: PlatformBucket[] = ['web', 'mobile', 'graphql', 'http'];

/** Buckets that reach their feature through a microfrontend, and so require one to resolve. */
export type UiPlatformBucket = 'web' | 'mobile';

export const UI_PLATFORMS: UiPlatformBucket[] = ['web', 'mobile'];

// The API surfaces an app credential can present — literally the values of core's `app_type` enum, so
// enforcement is a plain lookup with no mapping. A feature declares which surfaces expose it.
export const API_SURFACES = ['GRAPHQL', 'HTTP'] as const;
export type ApiSurface = (typeof API_SURFACES)[number];

/** Buckets that admit an API credential rather than a person — exactly one per surface. */
export type ApiBucket = Exclude<PlatformBucket, UiPlatformBucket>;

export const API_BUCKETS: ApiBucket[] = ['graphql', 'http'];

export const SURFACE_BY_BUCKET: Record<ApiBucket, ApiSurface> = { graphql: 'GRAPHQL', http: 'HTTP' };
export const BUCKET_BY_SURFACE: Record<ApiSurface, ApiBucket> = { GRAPHQL: 'graphql', HTTP: 'http' };

export function isApiBucket(bucket: PlatformBucket): bucket is ApiBucket {
  return bucket === 'graphql' || bucket === 'http';
}

// Documents written before GraphQL and HTTP were entitled separately may still carry a single legacy
// `app` bucket meaning "any API surface". It is deliberately NOT part of these shapes — nothing may
// write it — and is honoured only inside `normalizeApiBuckets`, which copies it into graphql/http.
export interface PlatformCodes {
  web?: string[];
  mobile?: string[];
  graphql?: string[];
  http?: string[];
}

export interface PlatformDenyCodes {
  web?: string[] | null;
  mobile?: string[] | null;
  graphql?: string[] | null;
  http?: string[] | null;
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
// External services a feature can depend on — the org must have the service provisioned before the feature
// unlocks. Add new services here and nowhere else in this package; every lock path is service-agnostic.
export const SERVICE_CODES = ['GITEA'] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];
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
  // Optional: snapshots built before service gating existed carry no services, which reads as "requires none"
  requiredServices?: ServiceCode[];
  // Optional: snapshots built before surface gating existed carry no list, which reads as "reachable by any
  // app credential". A present list is strict — it decides which of the `graphql`/`http` buckets the feature
  // offers at all, and `[]` offers neither. The builder always emits it, so only pre-flag snapshots are lenient.
  apiSurfaces?: ApiSurface[];
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

export const SNAPSHOT_SCHEMA_VERSION = 4;

// SERVICE = the org has not provisioned an external service the feature declares; the specific services are
// reported alongside in `missingServices` so callers never branch on a service code baked into this union
export type LockReason = 'PLAN' | 'SITE' | 'SERVICE';

export interface CatalogPermission {
  code: string;
  locked: boolean;
  lockReason: LockReason | null;
  unlockPlans: string[];
  missingServices: ServiceCode[];
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
  missingServices: ServiceCode[];
  permissions: CatalogPermission[];
}

export type RoleItem = SnapshotRoleTemplate;

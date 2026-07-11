// Catalog resolver — the single shared implementation of snapshot resolution (BU catalog, BU matrix, user features)
export {
  type SiteMatrix,
  type SiteMatrixApp,
  type SiteMatrixCell,
  type SiteMatrixFeature,
  type SiteMatrixPermission,
  buildSiteMatrix,
} from './site-matrix.builder';
export {
  buildSiteCatalog,
  buildSiteRoles,
  featureAppliesAtNode,
  isSiteLockedOnPlatform,
  isPlanMember,
} from './catalog.builder';
export { type ComposeRoleGrantsParams, composeRoleGrants, type RevokedGrants } from './compose-role-grants';
export {
  buildDependsMap,
  cascadeLocked,
  type DependsMap,
  filterGrantedByDeps,
  prereqClosure,
} from './permission-deps';
export {
  type ClientPlatform,
  type LockedPermission,
  type PermissionFeature,
  pickRouteForPlatform,
  type ResolveUserFeaturesParams,
  resolveUserFeatures,
} from './resolve-user-features';
export {
  type FeatureLocks,
  type SiteFeatureLocks,
  type CatalogPermission,
  type FeatureCatalogEntry,
  type FeatureUnlocks,
  type LockReason,
  PLATFORMS,
  type PlatformBucket,
  type PlatformCodes,
  type PlatformDenyCodes,
  type RoleItem,
  SITE_TYPES,
  type ScopeType,
  type SiteType,
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotApp,
  type BusinessVocabulary,
  type VocabularyEntry,
  type SnapshotBusiness,
  type SnapshotFeature,
  type SnapshotMicrofrontendMobile,
  type SnapshotMicrofrontends,
  type SnapshotMicrofrontendWeb,
  type SnapshotPermission,
  type SnapshotPlan,
  type SnapshotRoleTemplate,
  type VersionSnapshot,
} from './types';

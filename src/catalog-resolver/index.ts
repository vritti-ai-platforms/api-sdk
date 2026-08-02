// Catalog resolver — the single shared implementation of snapshot resolution (BU catalog, BU matrix, user features)

export {
  buildSiteCatalog,
  buildSiteRoles,
  featureAppliesAtNode,
  findFeatureByCode,
  isPlanMember,
  isSiteLockedOnPlatform,
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
  buildPlanMatrix,
  buildSiteMatrix,
  type SiteMatrix,
  type SiteMatrixApp,
  type SiteMatrixCell,
  type SiteMatrixFeature,
  type SiteMatrixPermission,
} from './site-matrix.builder';
export {
  type BusinessVocabulary,
  type CatalogPermission,
  type FeatureCatalogEntry,
  type FeatureLocks,
  type FeatureUnlocks,
  type LockReason,
  PLATFORMS,
  type PlatformBucket,
  type PlatformCodes,
  type PlatformDenyCodes,
  type RoleItem,
  type ScopeType,
  SERVICE_CODES,
  type ServiceCode,
  SITE_TYPES,
  type SiteFeatureLocks,
  type SiteType,
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotApp,
  type SnapshotAppFeatureRef,
  type SnapshotBusiness,
  type SnapshotFeature,
  type SnapshotMicrofrontendMobile,
  type SnapshotMicrofrontends,
  type SnapshotMicrofrontendWeb,
  type SnapshotPermission,
  type SnapshotPlan,
  type SnapshotRoleTemplate,
  snapshotFeatureKey,
  type VersionSnapshot,
  type VocabularyEntry,
} from './types';

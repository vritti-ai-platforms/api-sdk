// Catalog resolver — the single shared implementation of snapshot resolution (BU catalog, BU matrix, user features)
export {
  type BuMatrix,
  type BuMatrixApp,
  type BuMatrixCell,
  type BuMatrixFeature,
  type BuMatrixPermission,
  buildBuMatrix,
} from './bu-matrix.builder';
export { buildBuCatalog, buildBuRoles, isBuLockedOnPlatform, isPlanMember } from './catalog.builder';
export { type ComposeRoleGrantsParams, composeRoleGrants, type RevokedGrants } from './compose-role-grants';
export {
  type ClientPlatform,
  type LockedPermission,
  type PermissionFeature,
  pickRouteForPlatform,
  type ResolveUserFeaturesParams,
  resolveUserFeatures,
} from './resolve-user-features';
export {
  type BuFeatureLocks,
  type CatalogPermission,
  type FeatureCatalogEntry,
  type FeatureUnlocks,
  type LockReason,
  PLATFORMS,
  type PlatformBucket,
  type PlatformCodes,
  type PlatformDenyCodes,
  type RoleItem,
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotApp,
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

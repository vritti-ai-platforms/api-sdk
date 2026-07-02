// Catalog resolver — the single shared implementation of snapshot resolution (BU catalog, BU matrix, user features)
export {
  type BuMatrix,
  type BuMatrixApp,
  type BuMatrixCell,
  type BuMatrixFeature,
  type BuMatrixPermission,
  buildBuMatrix,
} from './bu-matrix.builder';
export { buildBuCatalog, buildBuRoles, isPlanMember, unlockedCodes } from './catalog.builder';
export {
  type ClientPlatform,
  type LockedPermission,
  type PermissionFeature,
  pickRouteForPlatform,
  type ResolveUserFeaturesParams,
  type RoleFeatureGrant,
  resolveUserFeatures,
} from './resolve-user-features';
export type {
  BuFeatureUnlocks,
  CatalogPermission,
  FeatureCatalogEntry,
  LockReason,
  RoleItem,
  SnapshotApp,
  SnapshotBusiness,
  SnapshotFeature,
  SnapshotMicrofrontendMobile,
  SnapshotMicrofrontends,
  SnapshotMicrofrontendWeb,
  SnapshotPermission,
  SnapshotPlan,
  SnapshotRoleTemplate,
  VersionSnapshot,
} from './types';

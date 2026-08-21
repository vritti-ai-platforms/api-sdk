import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildPlanMatrix,
  buildSiteMatrix,
  type SiteMatrix,
  type SiteMatrixFeature,
  type SiteMatrixPermission,
} from './site-matrix.builder';
import type { VersionSnapshot } from './types';

// Minimal snapshot: one business, one app, sales (web+mobile) and reports (web-only)
const snapshot: VersionSnapshot = {
  features: {
    'SITE.sales': {
      code: 'sales',
      name: 'Sales',
      lucideIcon: 'shopping-cart',
      sfSymbol: 'cart',
      materialSymbol: 'shopping_cart',
      scope: 'SITE',
      applicableSiteTypes: ['OUTLET'],
      permissions: [
        { code: 'sales.view', label: 'View', isGlobal: true, businesses: [], dependsOn: [] },
        { code: 'sales.create', label: 'Create', isGlobal: true, businesses: [], dependsOn: [] },
      ],
      microfrontends: {
        web: {
          code: 'mf-web',
          name: 'Sales Web',
          remoteEntry: 'https://web/remote.js',
          exposedModule: './Sales',
          routePrefix: '/sales',
        },
        mobile: {
          code: 'mf-mobile',
          name: 'Sales Mobile',
          remoteEntryAndroid: 'https://android/remote.js',
          remoteEntryIos: 'https://ios/remote.js',
          exposedModule: './SalesMobile',
          routePrefix: '/m/sales',
        },
      },
    },
    'ORG.catalog': {
      code: 'catalog',
      name: 'Catalog',
      lucideIcon: 'book',
      sfSymbol: 'book',
      materialSymbol: 'book',
      scope: 'ORG',
      applicableSiteTypes: ['OUTLET'],
      permissions: [{ code: 'catalog.view', label: 'View', isGlobal: true, businesses: [], dependsOn: [] }],
      microfrontends: {
        web: {
          code: 'mf-web',
          name: 'Catalog Web',
          remoteEntry: 'https://web/remote.js',
          exposedModule: './Catalog',
          routePrefix: '/catalog',
        },
      },
    },
    'SITE.reports': {
      code: 'reports',
      name: 'Reports',
      lucideIcon: 'bar-chart',
      sfSymbol: 'chart.bar',
      materialSymbol: 'bar_chart',
      scope: 'SITE',
      applicableSiteTypes: ['OUTLET'],
      permissions: [{ code: 'reports.view', label: 'View', isGlobal: true, businesses: [], dependsOn: [] }],
      microfrontends: {
        web: {
          code: 'mf-web',
          name: 'Reports Web',
          remoteEntry: 'https://web/remote.js',
          exposedModule: './Reports',
          routePrefix: '/reports',
        },
      },
    },
  },
  businesses: {
    RETAIL: {
      name: 'Retail',
      apps: [
        {
          code: 'pos',
          name: 'POS',
          icon: 'store',
          sortOrder: 1,
          features: [
            { code: 'catalog', scope: 'ORG' },
            { code: 'sales', scope: 'SITE' },
            { code: 'reports', scope: 'SITE' },
          ],
        },
      ],
      roleTemplates: {},
      plans: {
        PRO: {
          code: 'PRO',
          name: 'Pro',
          isCustom: false,
          maxSites: null,
          unlockedPermissions: {
            catalog: { web: ['catalog.view'] },
            sales: { web: ['sales.view', 'sales.create'], mobile: ['sales.view'] },
            reports: { web: ['reports.view'] },
          },
        },
      },
    },
  },
};

// Finds a permission row by feature + permission code
function findPerm(matrix: SiteMatrix, featureCode: string, permCode: string): SiteMatrixPermission {
  for (const app of matrix.apps) {
    for (const feature of app.features) {
      if (feature.code !== featureCode) continue;
      const perm = feature.permissions.find((p) => p.code === permCode);
      if (perm) return perm;
    }
  }
  throw new Error(`permission ${featureCode}/${permCode} not found`);
}

// Finds a feature row by code across all apps
function findFeature(matrix: SiteMatrix, featureCode: string): SiteMatrixFeature | undefined {
  for (const app of matrix.apps) {
    const feature = app.features.find((f) => f.code === featureCode);
    if (feature) return feature;
  }
  return undefined;
}

describe('buildSiteMatrix', () => {
  it('selects every in-plan cell when the BU overlay is absent', () => {
    const matrix = buildSiteMatrix(snapshot, 'RETAIL', 'PRO', undefined);

    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').web, { inPlan: true, selected: true, availableIn: [] });
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').mobile, { inPlan: true, selected: true, availableIn: [] });
    // sales.create is not in the plan on mobile → never selected
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.create').mobile, {
      inPlan: false,
      selected: false,
      availableIn: [],
    });
  });

  it('platform-null lock deselects the whole feature on that platform only', () => {
    const matrix = buildSiteMatrix(snapshot, 'RETAIL', 'PRO', { sales: { web: null } });

    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').web, { inPlan: true, selected: false, availableIn: [] });
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.create').web, {
      inPlan: true,
      selected: false,
      availableIn: [],
    });
    // Mobile untouched by the web-null lock
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').mobile, { inPlan: true, selected: true, availableIn: [] });
  });

  it('code-array lock deselects single codes on that platform only', () => {
    const matrix = buildSiteMatrix(snapshot, 'RETAIL', 'PRO', { sales: { web: ['sales.create'] } });

    assert.deepEqual(findPerm(matrix, 'sales', 'sales.create').web, {
      inPlan: true,
      selected: false,
      availableIn: [],
    });
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').web, { inPlan: true, selected: true, availableIn: [] });
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').mobile, { inPlan: true, selected: true, availableIn: [] });
  });

  it('a lock on an out-of-plan cell is inert', () => {
    const matrix = buildSiteMatrix(snapshot, 'RETAIL', 'PRO', { sales: { mobile: ['sales.create'] } });

    // The cell was already out of plan — unchanged by the lock
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.create').mobile, {
      inPlan: false,
      selected: false,
      availableIn: [],
    });
    // The in-plan web cell of the same code stays selected
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.create').web, { inPlan: true, selected: true, availableIn: [] });
  });

  it('a feature missing from the locks overlay stays fully selected (no staleness)', () => {
    const matrix = buildSiteMatrix(snapshot, 'RETAIL', 'PRO', { sales: { web: null, mobile: null } });

    assert.deepEqual(findPerm(matrix, 'reports', 'reports.view').web, {
      inPlan: true,
      selected: true,
      availableIn: [],
    });
  });

  it('skips non-SITE features and tags emitted features with SITE scope', () => {
    const matrix = buildSiteMatrix(snapshot, 'RETAIL', 'PRO', undefined);

    // The ORG-scoped catalog feature is excluded from the SITE matrix
    assert.equal(findFeature(matrix, 'catalog'), undefined);
    // Every emitted SITE feature carries scope 'SITE'
    assert.equal(findFeature(matrix, 'sales')?.scope, 'SITE');
    assert.equal(findFeature(matrix, 'reports')?.scope, 'SITE');
  });
});

describe('buildPlanMatrix', () => {
  it('includes features of every scope, each with its real scope', () => {
    const matrix = buildPlanMatrix(snapshot, 'RETAIL', 'PRO', undefined);

    // ORG and SITE features are both present
    assert.equal(findFeature(matrix, 'catalog')?.scope, 'ORG');
    assert.equal(findFeature(matrix, 'sales')?.scope, 'SITE');
    assert.equal(findFeature(matrix, 'reports')?.scope, 'SITE');
  });

  it('resolves plan membership for non-SITE features', () => {
    const matrix = buildPlanMatrix(snapshot, 'RETAIL', 'PRO', undefined);

    assert.deepEqual(findPerm(matrix, 'catalog', 'catalog.view').web, {
      inPlan: true,
      selected: true,
      availableIn: [],
    });
    // catalog is web-only — no mobile cell
    assert.equal(findPerm(matrix, 'catalog', 'catalog.view').mobile, null);
  });

  // Regression: plan membership once checked only web/mobile, so an API-only entitlement —
  // exactly the headless case the API buckets exist for — read as not-in-plan.
  it('an API-only plan entitlement still makes the feature a plan member', () => {
    const apiOnlyPlan: VersionSnapshot = JSON.parse(JSON.stringify(snapshot));
    const plan = apiOnlyPlan.businesses.RETAIL?.plans.PRO;
    assert.ok(plan);
    plan.unlockedPermissions.reports = { graphql: ['reports.view'] };

    const matrix = buildPlanMatrix(apiOnlyPlan, 'RETAIL', 'PRO', undefined);
    const reports = findFeature(matrix, 'reports');
    assert.equal(reports?.inPlan, true);
    assert.deepEqual(findPerm(matrix, 'reports', 'reports.view').graphql, {
      inPlan: true,
      selected: true,
      availableIn: [],
    });
    // The sibling surface is offered but not entitled
    assert.equal(findPerm(matrix, 'reports', 'reports.view').http?.inPlan, false);
  });

  // Documents written before the split carry one `app` bucket meaning "any API surface"
  it('a legacy app-bucket entitlement reads as in-plan on both surfaces', () => {
    const legacyPlan: VersionSnapshot = JSON.parse(JSON.stringify(snapshot));
    const plan = legacyPlan.businesses.RETAIL?.plans.PRO;
    assert.ok(plan);
    plan.unlockedPermissions.reports = { app: ['reports.view'] } as never;

    const matrix = buildPlanMatrix(legacyPlan, 'RETAIL', 'PRO', undefined);
    assert.equal(findFeature(matrix, 'reports')?.inPlan, true);
    assert.equal(findPerm(matrix, 'reports', 'reports.view').graphql?.inPlan, true);
    assert.equal(findPerm(matrix, 'reports', 'reports.view').http?.inPlan, true);
  });

  describe('the API columns follow the declared surfaces', () => {
    const withSurfaces = (apiSurfaces: ('GRAPHQL' | 'HTTP')[] | undefined): VersionSnapshot => {
      const next: VersionSnapshot = JSON.parse(JSON.stringify(snapshot));
      const reports = next.features['SITE.reports'];
      assert.ok(reports);
      if (apiSurfaces === undefined) delete reports.apiSurfaces;
      else reports.apiSurfaces = apiSurfaces;
      return next;
    };

    it('each declared surface gets its own column; undeclared shows none', () => {
      const matrix = buildPlanMatrix(withSurfaces(['GRAPHQL']), 'RETAIL', 'PRO', undefined);
      const reports = findFeature(matrix, 'reports');
      assert.ok(reports?.platforms.includes('graphql'));
      assert.equal(reports?.platforms.includes('http'), false);
      assert.equal(findPerm(matrix, 'reports', 'reports.view').http, null);
      assert.deepEqual(reports?.apiSurfaces, ['GRAPHQL']);
    });

    it('withheld from both columns when the feature declares no surface at all', () => {
      const matrix = buildPlanMatrix(withSurfaces([]), 'RETAIL', 'PRO', undefined);
      const reports = findFeature(matrix, 'reports');
      assert.equal(reports?.platforms.includes('graphql'), false);
      assert.equal(reports?.platforms.includes('http'), false);
      assert.equal(findPerm(matrix, 'reports', 'reports.view').graphql, null);
    });

    it('kept on both columns for a pre-flag snapshot that never declared surfaces', () => {
      const matrix = buildPlanMatrix(withSurfaces(undefined), 'RETAIL', 'PRO', undefined);
      const reports = findFeature(matrix, 'reports');
      assert.ok(reports?.platforms.includes('graphql'));
      assert.ok(reports?.platforms.includes('http'));
    });
  });
});

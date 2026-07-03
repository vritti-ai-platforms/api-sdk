import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { type BuMatrix, type BuMatrixPermission, buildBuMatrix } from './bu-matrix.builder';
import type { VersionSnapshot } from './types';

// Minimal snapshot: one business, one app, sales (web+mobile) and reports (web-only)
const snapshot: VersionSnapshot = {
  features: {
    sales: {
      code: 'sales',
      name: 'Sales',
      lucideIcon: 'shopping-cart',
      sfSymbol: 'cart',
      materialSymbol: 'shopping_cart',
      permissions: [
        { code: 'sales.view', label: 'View', isGlobal: true, businesses: [] },
        { code: 'sales.create', label: 'Create', isGlobal: true, businesses: [] },
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
    reports: {
      code: 'reports',
      name: 'Reports',
      lucideIcon: 'bar-chart',
      sfSymbol: 'chart.bar',
      materialSymbol: 'bar_chart',
      permissions: [{ code: 'reports.view', label: 'View', isGlobal: true, businesses: [] }],
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
      apps: [{ code: 'pos', name: 'POS', icon: 'store', sortOrder: 1, features: ['sales', 'reports'] }],
      roleTemplates: [],
      plans: {
        PRO: {
          code: 'PRO',
          name: 'Pro',
          isCustom: false,
          maxBusinessUnits: null,
          unlockedPermissions: {
            sales: { web: ['sales.view', 'sales.create'], mobile: ['sales.view'] },
            reports: { web: ['reports.view'] },
          },
        },
      },
    },
  },
};

// Finds a permission row by feature + permission code
function findPerm(matrix: BuMatrix, featureCode: string, permCode: string): BuMatrixPermission {
  for (const app of matrix.apps) {
    for (const feature of app.features) {
      if (feature.code !== featureCode) continue;
      const perm = feature.permissions.find((p) => p.code === permCode);
      if (perm) return perm;
    }
  }
  throw new Error(`permission ${featureCode}/${permCode} not found`);
}

describe('buildBuMatrix', () => {
  it('selects every in-plan cell when the BU overlay is absent', () => {
    const matrix = buildBuMatrix(snapshot, 'RETAIL', 'PRO', undefined);

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
    const matrix = buildBuMatrix(snapshot, 'RETAIL', 'PRO', { sales: { web: null } });

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
    const matrix = buildBuMatrix(snapshot, 'RETAIL', 'PRO', { sales: { web: ['sales.create'] } });

    assert.deepEqual(findPerm(matrix, 'sales', 'sales.create').web, {
      inPlan: true,
      selected: false,
      availableIn: [],
    });
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').web, { inPlan: true, selected: true, availableIn: [] });
    assert.deepEqual(findPerm(matrix, 'sales', 'sales.view').mobile, { inPlan: true, selected: true, availableIn: [] });
  });

  it('a lock on an out-of-plan cell is inert', () => {
    const matrix = buildBuMatrix(snapshot, 'RETAIL', 'PRO', { sales: { mobile: ['sales.create'] } });

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
    const matrix = buildBuMatrix(snapshot, 'RETAIL', 'PRO', { sales: { web: null, mobile: null } });

    assert.deepEqual(findPerm(matrix, 'reports', 'reports.view').web, {
      inPlan: true,
      selected: true,
      availableIn: [],
    });
  });
});

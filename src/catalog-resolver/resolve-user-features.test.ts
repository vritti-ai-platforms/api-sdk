import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { resolveUserFeatures } from './resolve-user-features';
import type { VersionSnapshot } from './types';

// Minimal snapshot: one business, one app, two features (sales web+mobile, reports web-only)
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
        { code: 'sales.void', label: 'Void', isGlobal: false, businesses: ['RETAIL'] },
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
        BASIC: {
          code: 'BASIC',
          name: 'Basic',
          isCustom: false,
          maxBusinessUnits: 1,
          unlockedPermissions: { sales: { web: ['sales.view'], mobile: ['sales.view'] } },
        },
        PRO: {
          code: 'PRO',
          name: 'Pro',
          isCustom: false,
          maxBusinessUnits: null,
          unlockedPermissions: {
            sales: { web: ['sales.view', 'sales.create', 'sales.void'], mobile: ['sales.view'] },
            reports: { web: ['reports.view'] },
          },
        },
      },
    },
  },
};

describe('resolveUserFeatures', () => {
  it('resolves granted features with the web route and lock overlay', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'BASIC',
      buUnlocks: undefined,
      roleFeatures: { sales: { app: 'pos', web: ['sales.view', 'sales.create'] } },
      platform: 'web',
    });

    assert.equal(features.length, 1);
    const sales = features[0];
    assert.equal(sales.code, 'sales');
    assert.deepEqual(sales.permissions, ['sales.view', 'sales.create']);
    assert.deepEqual(sales.route, {
      remoteEntry: 'https://web/remote.js',
      exposedModule: './Sales',
      routePrefix: '/sales',
    });
    assert.equal(sales.locked, false);
    // sales.create is granted by the role but not unlocked by BASIC → surfaced as plan-locked with PRO upsell
    assert.deepEqual(sales.lockedPermissions, [{ code: 'sales.create', reason: 'PLAN', unlockPlans: ['PRO'] }]);
    assert.equal(sales.appCode, 'pos');
    assert.equal(sales.appSortOrder, 1);
  });

  it('emits a plan-omitted feature as fully locked with unlock plans (not vanished)', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'BASIC',
      buUnlocks: undefined,
      roleFeatures: { reports: { app: 'pos', web: ['reports.view'] } },
      platform: 'web',
    });

    assert.equal(features.length, 1);
    assert.equal(features[0].locked, true);
    assert.equal(features[0].lockReason, 'PLAN');
    assert.deepEqual(features[0].unlockPlans, ['PRO']);
  });

  it('gates membership per platform and picks the per-OS mobile remote entry', () => {
    const params = {
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      buUnlocks: undefined,
      roleFeatures: { sales: { app: 'pos', mobile: ['sales.view'] }, reports: { app: 'pos', web: ['reports.view'] } },
    };
    const ios = resolveUserFeatures({ ...params, platform: 'ios' });
    const android = resolveUserFeatures({ ...params, platform: 'android' });

    // reports has no mobile grant bucket and no mobile MF → only sales resolves
    assert.equal(ios.length, 1);
    assert.equal(ios[0].route.remoteEntry, 'https://ios/remote.js');
    assert.equal(android[0].route.remoteEntry, 'https://android/remote.js');
  });

  it('applies BU unlocks as a restriction within the plan', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      buUnlocks: { sales: { web: ['sales.view'] } },
      roleFeatures: { sales: { app: 'pos', web: ['sales.view', 'sales.create'] } },
      platform: 'web',
    });

    assert.deepEqual(features[0].lockedPermissions, [{ code: 'sales.create', reason: 'BU', unlockPlans: [] }]);
  });

  it('tolerates the legacy flat string[] grant shape', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      buUnlocks: undefined,
      roleFeatures: { sales: ['sales.view'] },
      platform: 'web',
    });

    assert.equal(features.length, 1);
    assert.deepEqual(features[0].permissions, ['sales.view']);
  });
});

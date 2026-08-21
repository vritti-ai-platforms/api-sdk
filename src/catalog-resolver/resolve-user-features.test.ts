import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { resolveUserFeatures } from './resolve-user-features';
import type { SnapshotFeature, VersionSnapshot } from './types';

// Narrows an indexed access to non-null for assertions (noUncheckedIndexedAccess); throws if absent.
function must<T>(value: T | undefined | null): T {
  assert.ok(value != null);
  return value;
}

// Minimal snapshot: one business, one app, two features (sales web+mobile, reports web-only)
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
        { code: 'sales.void', label: 'Void', isGlobal: false, businesses: ['RETAIL'], dependsOn: [] },
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
    'SITE.repositories': {
      code: 'repositories',
      name: 'Repositories',
      lucideIcon: 'git-branch',
      sfSymbol: 'chevron.left.forwardslash.chevron.right',
      materialSymbol: 'code',
      scope: 'SITE',
      applicableSiteTypes: ['OUTLET'],
      permissions: [{ code: 'repositories.view', label: 'View', isGlobal: true, businesses: [], dependsOn: [] }],
      requiredServices: ['GITEA'],
      microfrontends: {
        web: {
          code: 'mf-web',
          name: 'Repositories Web',
          remoteEntry: 'https://web/remote.js',
          exposedModule: './Repositories',
          routePrefix: '/repositories',
        },
      },
    },
    'ORG.dashboard': {
      code: 'dashboard',
      name: 'Dashboard',
      lucideIcon: 'layout-dashboard',
      sfSymbol: 'square.grid.2x2',
      materialSymbol: 'dashboard',
      scope: 'ORG',
      applicableSiteTypes: [],
      permissions: [{ code: 'dashboard.view', label: 'View', isGlobal: true, businesses: [], dependsOn: [] }],
      microfrontends: {
        web: {
          code: 'mf-web',
          name: 'Dashboard Web',
          remoteEntry: 'https://web/remote.js',
          exposedModule: './Dashboard',
          routePrefix: '/dashboard',
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
            { code: 'sales', scope: 'SITE' },
            { code: 'reports', scope: 'SITE' },
            { code: 'repositories', scope: 'SITE' },
            { code: 'dashboard', scope: 'ORG' },
          ],
        },
      ],
      roleTemplates: {},
      plans: {
        BASIC: {
          code: 'BASIC',
          name: 'Basic',
          isCustom: false,
          maxSites: 1,
          unlockedPermissions: { sales: { web: ['sales.view'], mobile: ['sales.view'] } },
        },
        PRO: {
          code: 'PRO',
          name: 'Pro',
          isCustom: false,
          maxSites: null,
          unlockedPermissions: {
            sales: { web: ['sales.view', 'sales.create', 'sales.void'], mobile: ['sales.view'] },
            reports: { web: ['reports.view'] },
            repositories: { web: ['repositories.view'] },
            dashboard: { web: ['dashboard.view'] },
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
      siteLocks: undefined,
      roleFeatures: { sales: { web: ['sales.view', 'sales.create'] } },
      platform: 'web',
    });

    assert.equal(features.length, 1);
    const sales = must(features[0]);
    assert.equal(sales.code, 'sales');
    assert.deepEqual(sales.permissions, ['sales.view', 'sales.create']);
    assert.deepEqual(sales.route, {
      remoteEntry: 'https://web/remote.js',
      exposedModule: './Sales',
      routePrefix: '/sales',
    });
    assert.equal(sales.locked, false);
    // sales.create is granted by the role but not unlocked by BASIC → surfaced as plan-locked with PRO upsell
    assert.deepEqual(sales.lockedPermissions, [
      { code: 'sales.create', reason: 'PLAN', unlockPlans: ['PRO'], missingServices: [] },
    ]);
    assert.equal(sales.appCode, 'pos');
    assert.equal(sales.appSortOrder, 1);
  });

  it('emits a plan-omitted feature as fully locked with unlock plans (not vanished)', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'BASIC',
      siteLocks: undefined,
      roleFeatures: { reports: { web: ['reports.view'] } },
      platform: 'web',
    });

    assert.equal(features.length, 1);
    const feature = must(features[0]);
    assert.equal(feature.locked, true);
    assert.equal(feature.lockReason, 'PLAN');
    assert.deepEqual(feature.unlockPlans, ['PRO']);
  });

  it('locks a service-dependent feature when the org has not provisioned the service', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { repositories: { web: ['repositories.view'] } },
      platform: 'web',
      availableServices: [],
    });

    assert.equal(features.length, 1);
    const feature = must(features[0]);
    assert.equal(feature.locked, true);
    assert.equal(feature.lockReason, 'SERVICE');
    // The reason stays generic; which services are missing is reported separately
    assert.deepEqual(feature.missingServices, ['GITEA']);
    // A service lock is not a plan problem — no plan would unlock it, so nothing to upsell
    assert.deepEqual(feature.unlockPlans, []);
    assert.deepEqual(feature.upsell, []);
    // The granted permissions must report locked too, the way plan and site locks do
    assert.deepEqual(feature.lockedPermissions, [
      { code: 'repositories.view', reason: 'SERVICE', unlockPlans: [], missingServices: ['GITEA'] },
    ]);
  });

  it('unlocks a service-dependent feature once the service is provisioned', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { repositories: { web: ['repositories.view'] } },
      platform: 'web',
      availableServices: ['GITEA'],
    });

    const feature = must(features[0]);
    assert.equal(feature.locked, false);
    assert.equal(feature.lockReason, null);
    assert.deepEqual(feature.missingServices, []);
    assert.deepEqual(feature.lockedPermissions, []);
  });

  it('omitting availableServices fails closed rather than leaking a service-dependent feature', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { repositories: { web: ['repositories.view'] } },
      platform: 'web',
    });

    const feature = must(features[0]);
    assert.equal(feature.locked, true);
    assert.equal(feature.lockReason, 'SERVICE');
    assert.deepEqual(feature.missingServices, ['GITEA']);
  });

  it('reports a plan lock ahead of a service lock so the user sees an upgrade, not a setup prompt', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'BASIC',
      siteLocks: undefined,
      roleFeatures: { repositories: { web: ['repositories.view'] } },
      platform: 'web',
      availableServices: [],
    });

    const feature = must(features[0]);
    assert.equal(feature.locked, true);
    assert.equal(feature.lockReason, 'PLAN');
    assert.deepEqual(feature.unlockPlans, ['PRO']);
  });

  it('gates membership per platform and picks the per-OS mobile remote entry', () => {
    const params = {
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { sales: { mobile: ['sales.view'] }, reports: { web: ['reports.view'] } },
    };
    const ios = resolveUserFeatures({ ...params, platform: 'ios' });
    const android = resolveUserFeatures({ ...params, platform: 'android' });

    // reports has no mobile grant bucket and no mobile MF → only sales resolves
    assert.equal(ios.length, 1);
    assert.equal(must(ios[0]).route.remoteEntry, 'https://ios/remote.js');
    assert.equal(must(android[0]).route.remoteEntry, 'https://android/remote.js');
  });

  it('applies BU locks as a deny-list on the resolving platform', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: { sales: { web: ['sales.create'], mobile: null } },
      roleFeatures: { sales: { web: ['sales.view', 'sales.create'] } },
      platform: 'web',
    });

    // sales.create: locked on web (code) + mobile (feature null) → BU-locked; sales.view stays open via web
    assert.deepEqual(must(features[0]).lockedPermissions, [
      { code: 'sales.create', reason: 'SITE', unlockPlans: [], missingServices: [] },
    ]);
  });

  it('leaves everything available when the BU overlay is absent', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { sales: { web: ['sales.view', 'sales.create', 'sales.void'] } },
      platform: 'web',
    });

    const feature = must(features[0]);
    assert.equal(feature.locked, false);
    assert.deepEqual(feature.lockedPermissions, []);
  });

  it('locks a code on the platform it is locked on, leaving the other platform open', () => {
    const params = {
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: { sales: { web: ['sales.view'] } },
      roleFeatures: { sales: { web: ['sales.view'], mobile: ['sales.view'] } },
    };
    const web = resolveUserFeatures({ ...params, platform: 'web' as const });
    const mobile = resolveUserFeatures({ ...params, platform: 'ios' as const });

    // The lock covers web only → BU-locked on web, untouched on mobile
    assert.deepEqual(must(web[0]).lockedPermissions, [
      { code: 'sales.view', reason: 'SITE', unlockPlans: [], missingServices: [] },
    ]);
    assert.deepEqual(must(mobile[0]).lockedPermissions, []);
  });

  it('treats a BU lock on an out-of-plan code as inert (PLAN reason + upsell win)', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'BASIC',
      siteLocks: { sales: { web: ['sales.create'], mobile: ['sales.create'] } },
      roleFeatures: { sales: { web: ['sales.view', 'sales.create'] } },
      platform: 'web',
    });

    assert.deepEqual(must(features[0]).lockedPermissions, [
      { code: 'sales.create', reason: 'PLAN', unlockPlans: ['PRO'], missingServices: [] },
    ]);
  });

  it('resolves a feature missing from the locks overlay as fully available (no staleness)', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: { sales: { web: null, mobile: null } },
      roleFeatures: { reports: { web: ['reports.view'] } },
      platform: 'web',
    });

    const feature = must(features[0]);
    assert.equal(feature.locked, false);
    assert.deepEqual(feature.lockedPermissions, []);
  });

  it('locks the whole feature with reason BU when every shipped platform is null-locked', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: { sales: { web: null, mobile: null } },
      roleFeatures: { sales: { web: ['sales.view', 'sales.create', 'sales.void'] } },
      platform: 'web',
    });

    const feature = must(features[0]);
    assert.equal(feature.locked, true);
    assert.equal(feature.lockReason, 'SITE');
    assert.deepEqual(feature.unlockPlans, []);
  });

  it('resolves every granted feature regardless of scope when no scope is requested', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { sales: { web: ['sales.view'] }, dashboard: { web: ['dashboard.view'] } },
      platform: 'web',
    });

    assert.deepEqual(features.map((f) => f.code).sort(), ['dashboard', 'sales']);
  });

  it('drops features whose scope differs from the requested workspace scope', () => {
    const params = {
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { sales: { web: ['sales.view'] }, dashboard: { web: ['dashboard.view'] } },
      platform: 'web' as const,
    };
    const site = resolveUserFeatures({ ...params, scope: 'SITE', siteType: 'OUTLET' });
    const org = resolveUserFeatures({ ...params, scope: 'ORG' });

    // SITE workspace only sees SITE-scoped features; ORG workspace only ORG-scoped ones
    assert.deepEqual(
      site.map((f) => f.code),
      ['sales'],
    );
    assert.deepEqual(
      org.map((f) => f.code),
      ['dashboard'],
    );
  });

  it('returns nothing for a scope with no matching features', () => {
    const features = resolveUserFeatures({
      snapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { sales: { web: ['sales.view'] } },
      platform: 'web',
      scope: 'LE',
    });

    assert.deepEqual(features, []);
  });

  it('keeps same-code features at different scopes distinct (no collision)', () => {
    const webMf = {
      code: 'mf-web',
      name: 'Inventory Web',
      remoteEntry: 'https://web/remote.js',
      exposedModule: './Inventory',
      routePrefix: '/inventory-items',
    };
    const inventoryFeature = (name: string, scope: 'ORG' | 'SITE'): SnapshotFeature => ({
      code: 'inventory-items',
      name,
      lucideIcon: 'boxes',
      sfSymbol: 'shippingbox',
      materialSymbol: 'inventory',
      scope,
      applicableSiteTypes: scope === 'SITE' ? ['OUTLET'] : [],
      permissions: [{ code: 'view', label: 'View', isGlobal: true, businesses: [], dependsOn: [] }],
      microfrontends: { web: webMf },
    });
    const collisionSnapshot: VersionSnapshot = {
      features: {
        // Same code, distinct composite keys — both variants survive
        'ORG.inventory-items': inventoryFeature('Org Inventory', 'ORG'),
        'SITE.inventory-items': inventoryFeature('Site Inventory', 'SITE'),
      },
      businesses: {
        RETAIL: {
          name: 'Retail',
          apps: [
            {
              code: 'master',
              name: 'Master',
              icon: 'settings',
              sortOrder: 1,
              features: [{ code: 'inventory-items', scope: 'ORG' }],
            },
            {
              code: 'inventory',
              name: 'Inventory',
              icon: 'boxes',
              sortOrder: 2,
              features: [{ code: 'inventory-items', scope: 'SITE' }],
            },
          ],
          roleTemplates: {},
          plans: {
            PRO: {
              code: 'PRO',
              name: 'Pro',
              isCustom: false,
              maxSites: null,
              unlockedPermissions: { 'inventory-items': { web: ['view'] } },
            },
          },
        },
      },
    };
    const params = {
      snapshot: collisionSnapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      roleFeatures: { 'inventory-items': { web: ['view'] } },
      platform: 'web' as const,
    };

    const org = resolveUserFeatures({ ...params, scope: 'ORG' });
    const site = resolveUserFeatures({ ...params, scope: 'SITE', siteType: 'OUTLET' });

    // Each scope resolves its OWN variant — correct name + owning app, not the collided last-write-wins one
    assert.deepEqual(
      org.map((f) => [f.name, f.appCode]),
      [['Org Inventory', 'master']],
    );
    assert.deepEqual(
      site.map((f) => [f.name, f.appCode]),
      [['Site Inventory', 'inventory']],
    );
  });

  describe('the app bucket', () => {
    // A webhook feed or a signed API surface: real permissions, nothing to render.
    const headless: SnapshotFeature = {
      code: 'feeds',
      name: 'Feeds',
      lucideIcon: 'rss',
      sfSymbol: 'dot.radiowaves.up.forward',
      materialSymbol: 'rss_feed',
      scope: 'ORG',
      applicableSiteTypes: [],
      permissions: [
        { code: 'view', label: 'View', isGlobal: true, businesses: [], dependsOn: [] },
        { code: 'add', label: 'Add', isGlobal: true, businesses: [], dependsOn: ['view'] },
      ],
      // No microfrontend at all — the case that was previously unreachable
      microfrontends: {},
    };

    const headlessSnapshot: VersionSnapshot = {
      features: { 'ORG.feeds': headless },
      businesses: {
        RETAIL: {
          name: 'Retail',
          roleTemplates: {},
          apps: [
            { code: 'integrations', name: 'Integrations', icon: 'plug', sortOrder: 1,
              features: [{ code: 'feeds', scope: 'ORG' }] },
          ],
          plans: {
            PRO: {
              code: 'PRO', name: 'Pro', isCustom: false, maxSites: null,
              unlockedPermissions: { feeds: { app: ['view', 'add'] } },
            },
          },
        },
      },
    };

    const params = {
      snapshot: headlessSnapshot,
      businessCode: 'RETAIL',
      planCode: 'PRO',
      siteLocks: undefined,
      scope: 'ORG' as const,
    };

    it('resolves a feature that ships no microfrontend', () => {
      const features = resolveUserFeatures({
        ...params,
        roleFeatures: { feeds: { app: ['view', 'add'] } },
        platform: 'app',
      });
      assert.equal(features.length, 1);
      assert.deepEqual(must(features[0]).permissions.sort(), ['add', 'view']);
      assert.equal(must(features[0]).locked, false);
    });

    it('still drops that feature for a UI bucket, which has nothing to load', () => {
      const features = resolveUserFeatures({
        ...params,
        roleFeatures: { feeds: { web: ['view'] } },
        platform: 'web',
      });
      assert.deepEqual(features, []);
    });

    it('reads only the app array — a web grant does not carry over', () => {
      const features = resolveUserFeatures({
        ...params,
        roleFeatures: { feeds: { web: ['view', 'add'] } },
        platform: 'app',
      });
      assert.deepEqual(features, []);
    });

    it('is bounded by what the plan unlocks on app, not on web', () => {
      const webOnlyPlan: VersionSnapshot = {
        ...headlessSnapshot,
        businesses: {
          RETAIL: {
            ...must(headlessSnapshot.businesses.RETAIL),
            plans: {
              PRO: {
                code: 'PRO', name: 'Pro', isCustom: false, maxSites: null,
                // Everything unlocked for the browser, nothing for API clients
                unlockedPermissions: { feeds: { web: ['view', 'add'] } },
              },
            },
          },
        },
      };
      const features = resolveUserFeatures({
        ...params,
        snapshot: webOnlyPlan,
        roleFeatures: { feeds: { app: ['view', 'add'] } },
        platform: 'app',
      });
      // Granted, but the plan does not entitle it on this surface — surfaced locked, not enabled
      assert.equal(features.length, 1);
      assert.equal(must(features[0]).locked, true);
    });
  });
});

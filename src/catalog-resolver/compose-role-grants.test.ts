import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { composeRoleGrants } from './compose-role-grants';

describe('composeRoleGrants', () => {
  it('passes base grants through unchanged when there are no additions or revokes', () => {
    const baseFeatures = { sales: { app: 'pos', web: ['sales.view'], mobile: ['sales.view'] } };
    const result = composeRoleGrants({ baseFeatures, additions: {}, revoked: undefined });

    assert.deepEqual(result, { sales: { app: 'pos', web: ['sales.view'], mobile: ['sales.view'] } });
    // Fresh objects — inputs are never mutated or aliased
    assert.notEqual(result.sales, baseFeatures.sales);
    assert.notEqual(result.sales.web, baseFeatures.sales.web);
  });

  it('uses additions alone for a standalone role (undefined base)', () => {
    const result = composeRoleGrants({
      baseFeatures: undefined,
      additions: { reports: { app: 'pos', web: ['reports.view'] } },
      revoked: undefined,
    });

    assert.deepEqual(result, { reports: { app: 'pos', web: ['reports.view'] } });
  });

  it('unions and dedupes codes per platform, taking app from the base first', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { app: 'pos', web: ['sales.view', 'sales.create'] } },
      additions: { sales: { app: 'other', web: ['sales.create', 'sales.void'], mobile: ['sales.view'] } },
      revoked: undefined,
    });

    assert.deepEqual(result, {
      sales: { app: 'pos', web: ['sales.view', 'sales.create', 'sales.void'], mobile: ['sales.view'] },
    });
  });

  it('subtracts revoked codes but keeps platform membership (may leave view-only [])', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { app: 'pos', web: ['sales.view', 'sales.create'], mobile: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: ['sales.create'], mobile: ['sales.view'] } },
    });

    // web keeps its remaining code; mobile stays a member with zero actions (view-only gate)
    assert.deepEqual(result, { sales: { app: 'pos', web: ['sales.view'], mobile: [] } });
  });

  it('removes platform membership entirely on a null revoke', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { app: 'pos', web: ['sales.view'], mobile: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: null } },
    });

    assert.equal('web' in result.sales, false);
    assert.deepEqual(result, { sales: { app: 'pos', mobile: ['sales.view'] } });
  });

  it('ignores a revoked code the merged grants do not contain', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { app: 'pos', web: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: ['sales.void'] } },
    });

    assert.deepEqual(result, { sales: { app: 'pos', web: ['sales.view'] } });
  });

  it('drops a feature whose every platform is revoked', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { app: 'pos', web: ['sales.view'], mobile: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: null, mobile: null } },
    });

    assert.deepEqual(result, {});
  });

  it('degrades to additions minus revoked when the base template is missing', () => {
    const result = composeRoleGrants({
      baseFeatures: undefined,
      additions: { sales: { app: 'pos', web: ['sales.view', 'sales.create'] } },
      revoked: { sales: { web: ['sales.create'] } },
    });

    assert.deepEqual(result, { sales: { app: 'pos', web: ['sales.view'] } });
  });

  it('preserves empty-array platform membership through the merge', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { app: 'pos', web: [] } },
      additions: { sales: { mobile: [] } },
      revoked: undefined,
    });

    assert.deepEqual(result, { sales: { app: 'pos', web: [], mobile: [] } });
  });

  it('tolerates the legacy flat string[] grant shape as both-platform codes', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: ['sales.view'] },
      additions: { sales: { app: 'pos', web: ['sales.create'] } },
      revoked: { sales: { mobile: ['sales.view'] } },
    });

    assert.deepEqual(result, { sales: { app: 'pos', web: ['sales.view', 'sales.create'], mobile: [] } });
  });
});

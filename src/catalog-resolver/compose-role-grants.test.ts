import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { composeRoleGrants } from './compose-role-grants';

describe('composeRoleGrants', () => {
  it('passes base grants through unchanged when there are no additions or revokes', () => {
    const baseFeatures = { sales: { web: ['sales.view'], mobile: ['sales.view'] } };
    const result = composeRoleGrants({ baseFeatures, additions: {}, revoked: undefined });

    assert.deepEqual(result, { sales: { web: ['sales.view'], mobile: ['sales.view'] } });
    // Fresh objects — inputs are never mutated or aliased
    assert.notEqual(result.sales, baseFeatures.sales);
    assert.notEqual(result.sales.web, baseFeatures.sales.web);
  });

  it('uses additions alone for a standalone role (undefined base)', () => {
    const result = composeRoleGrants({
      baseFeatures: undefined,
      additions: { reports: { web: ['reports.view'] } },
      revoked: undefined,
    });

    assert.deepEqual(result, { reports: { web: ['reports.view'] } });
  });

  it('unions and dedupes codes per platform', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { web: ['sales.view', 'sales.create'] } },
      additions: { sales: { web: ['sales.create', 'sales.void'], mobile: ['sales.view'] } },
      revoked: undefined,
    });

    assert.deepEqual(result, {
      sales: { web: ['sales.view', 'sales.create', 'sales.void'], mobile: ['sales.view'] },
    });
  });

  it('subtracts revoked codes but keeps platform membership (may leave view-only [])', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { web: ['sales.view', 'sales.create'], mobile: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: ['sales.create'], mobile: ['sales.view'] } },
    });

    // web keeps its remaining code; mobile stays a member with zero actions (view-only gate)
    assert.deepEqual(result, { sales: { web: ['sales.view'], mobile: [] } });
  });

  it('removes platform membership entirely on a null revoke', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { web: ['sales.view'], mobile: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: null } },
    });

    assert.equal('web' in result.sales, false);
    assert.deepEqual(result, { sales: { mobile: ['sales.view'] } });
  });

  it('ignores a revoked code the merged grants do not contain', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { web: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: ['sales.void'] } },
    });

    assert.deepEqual(result, { sales: { web: ['sales.view'] } });
  });

  it('drops a feature whose every platform is revoked', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { web: ['sales.view'], mobile: ['sales.view'] } },
      additions: {},
      revoked: { sales: { web: null, mobile: null } },
    });

    assert.deepEqual(result, {});
  });

  it('degrades to additions minus revoked when the base template is missing', () => {
    const result = composeRoleGrants({
      baseFeatures: undefined,
      additions: { sales: { web: ['sales.view', 'sales.create'] } },
      revoked: { sales: { web: ['sales.create'] } },
    });

    assert.deepEqual(result, { sales: { web: ['sales.view'] } });
  });

  it('preserves empty-array platform membership through the merge', () => {
    const result = composeRoleGrants({
      baseFeatures: { sales: { web: [] } },
      additions: { sales: { mobile: [] } },
      revoked: undefined,
    });

    assert.deepEqual(result, { sales: { web: [], mobile: [] } });
  });
});

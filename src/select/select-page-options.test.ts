import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { selectPageOptions } from './select-page-options';

describe('selectPageOptions', () => {
  it('carries the paging and search through', () => {
    assert.deepEqual(
      selectPageOptions({ search: 'tab', limit: 20, offset: 40, values: 'a,b', excludeIds: 'c', withTotalCount: true }),
      { search: 'tab', limit: 20, offset: 40, values: 'a,b', excludeIds: 'c', withTotalCount: true },
    );
  });

  it('leaves out the endpoint-owned keys', () => {
    const query = { search: 'tab', valueKey: 'code', labelKey: 'secret', additionalKeys: 'cost' };
    assert.deepEqual(Object.keys(selectPageOptions(query)).sort(), [
      'excludeIds',
      'limit',
      'offset',
      'search',
      'values',
      'withTotalCount',
    ]);
  });
});

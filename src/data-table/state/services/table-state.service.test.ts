import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@vritti/api-sdk/cache';
import type { FilterCondition } from '@vritti/api-sdk/conditions';
import type { TableState } from '../../table-state.types';
import { TableStateService } from './table-state.service';

const status: FilterCondition = { field: 'status', operator: 'isAnyOf', value: ['ACTIVE'] };

// A state service over an in-memory cache
function stateService() {
  const store = new Map<string, unknown>();
  const cache = {
    get: async (key: string) => store.get(key) ?? null,
    getOrThrow: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  } as unknown as CacheService;
  const config = { get: () => undefined } as unknown as ConfigService;
  return { service: new TableStateService(cache, config), store };
}

describe('TableStateService.getTableState', () => {
  it('returns an empty state on a miss', async () => {
    const { service } = stateService();
    const { state, activeViewId } = await service.getTableState('user', 'items');
    assert.deepEqual(state.filters, { panel: [], context: [] });
    assert.equal(activeViewId, null);
  });

  it('does not share the empty filters between misses', async () => {
    const { service } = stateService();
    const first = await service.getTableState('user', 'items');
    first.state.filters.panel.push(status);
    const second = await service.getTableState('user', 'items');
    assert.deepEqual(second.state.filters.panel, []);
  });

  it('returns the stored state on a hit', async () => {
    const { service, store } = stateService();
    const filters = { panel: [status], context: [] };
    store.set('table-state:user:items', { state: { filters, sort: [] }, activeViewId: 'view-1' });
    const { state, activeViewId } = await service.getTableState('user', 'items');
    assert.deepEqual(state.filters, filters);
    assert.equal(activeViewId, 'view-1');
  });
});

describe('TableStateService.putTableState', () => {
  it('stores the state as sent', async () => {
    const { service, store } = stateService();
    const sent = { filters: { panel: [], context: [status] }, sort: [] } as unknown as TableState;
    await service.putTableState('user', { tableSlug: 'items', state: sent, activeViewId: null });
    const stored = store.get('table-state:user:items') as { state: TableState };
    assert.deepEqual(stored.state, sent);
  });
});

describe('TableStateService.patchTableState', () => {
  const site: FilterCondition = { field: 'site', operator: 'equals', value: 'site-2' };

  it('replaces the condition on the same field and keeps the rest of the state', async () => {
    const { service, store } = stateService();
    const stored = {
      filters: { panel: [status], context: [{ field: 'site', operator: 'equals', value: 'site-1' }, status] },
      sort: [{ field: 'name', direction: 'asc' }],
    } as unknown as TableState;
    await service.putTableState('user', { tableSlug: 'prices', state: stored, activeViewId: 'view-1' });

    await service.patchTableState('user', { tableSlug: 'prices', context: [site] });

    const { state, activeViewId } = await service.getTableState('user', 'prices');
    assert.deepEqual(state.filters.context, [status, site]);
    assert.deepEqual(state.filters.panel, [status]);
    assert.deepEqual(state.sort, [{ field: 'name', direction: 'asc' }]);
    assert.equal(activeViewId, 'view-1');
    assert.ok(store.has('table-state:user:prices'));
  });

  it('starts a table with no stored state from the empty one', async () => {
    const { service } = stateService();
    await service.patchTableState('user', { tableSlug: 'prices', context: [site] });
    const { state, activeViewId } = await service.getTableState('user', 'prices');
    assert.deepEqual(state.filters, { panel: [], context: [site] });
    assert.equal(activeViewId, null);
  });
});

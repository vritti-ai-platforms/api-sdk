import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@vritti/api-sdk/cache';
import type { FilterCondition, TableViewState } from '../../filter/filter.types';
import { DataTableStateService } from './data-table-state.service';

const status: FilterCondition = { field: 'status', operator: 'isAnyOf', value: ['ACTIVE'] };

// A state service over an in-memory cache
function stateService() {
  const store = new Map<string, unknown>();
  const cache = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  } as unknown as CacheService;
  const config = { get: () => undefined } as unknown as ConfigService;
  return { service: new DataTableStateService(cache, config), store };
}

describe('DataTableStateService.getCurrentState', () => {
  it('returns an empty state on a miss', async () => {
    const { service } = stateService();
    const { state, activeViewId } = await service.getCurrentState('user', 'items');
    assert.deepEqual(state.filters, { panel: [], context: [] });
    assert.equal(activeViewId, null);
  });

  it('does not share the empty filters between misses', async () => {
    const { service } = stateService();
    const first = await service.getCurrentState('user', 'items');
    first.state.filters.panel.push(status);
    const second = await service.getCurrentState('user', 'items');
    assert.deepEqual(second.state.filters.panel, []);
  });

  it('returns the stored state on a hit', async () => {
    const { service, store } = stateService();
    const filters = { panel: [status], context: [] };
    store.set('table-state:user:items', { state: { filters, sort: [] }, activeViewId: 'view-1' });
    const { state, activeViewId } = await service.getCurrentState('user', 'items');
    assert.deepEqual(state.filters, filters);
    assert.equal(activeViewId, 'view-1');
  });
});

describe('DataTableStateService.upsertCurrentState', () => {
  it('stores the state as sent', async () => {
    const { service, store } = stateService();
    const sent = { filters: { panel: [], context: [status] }, sort: [] } as unknown as TableViewState;
    await service.upsertCurrentState('user', { tableSlug: 'items', state: sent, activeViewId: null });
    const stored = store.get('table-state:user:items') as { state: TableViewState };
    assert.deepEqual(stored.state, sent);
  });
});

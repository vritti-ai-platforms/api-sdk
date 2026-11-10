import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@vritti/api-sdk/cache';
import type { FilterCondition } from '@vritti/api-sdk/conditions';
import { ContextStateService } from './context-state.service';

const site: FilterCondition = { field: 'site', operator: 'equals', value: 'site-1' };
const period: FilterCondition = { field: 'period', operator: 'between', value: ['2026-09-01', '2026-12-01'] };

// A context state service over an in-memory cache
function contextStateService() {
  const store = new Map<string, unknown>();
  const cache = {
    get: async (key: string) => store.get(key) ?? null,
    getOrThrow: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  } as unknown as CacheService;
  const config = { get: () => undefined } as unknown as ConfigService;
  return { service: new ContextStateService(cache, config), store };
}

describe('ContextStateService', () => {
  it('returns no context on a miss', async () => {
    const { service } = contextStateService();
    assert.deepEqual(await service.getContextState('user', 'graph'), []);
  });

  it('replaces the whole context on put', async () => {
    const { service, store } = contextStateService();
    await service.putContextState('user', { slug: 'graph', context: [site, period] });
    await service.putContextState('user', { slug: 'graph', context: [period] });
    assert.deepEqual(await service.getContextState('user', 'graph'), [period]);
    assert.ok(store.has('context-state:user:graph'));
  });

  it('replaces only the patched fields and keeps the rest', async () => {
    const { service } = contextStateService();
    await service.putContextState('user', { slug: 'graph', context: [site, period] });
    const otherSite: FilterCondition = { field: 'site', operator: 'equals', value: 'site-2' };
    await service.patchContextState('user', { slug: 'graph', context: [otherSite] });
    assert.deepEqual(await service.getContextState('user', 'graph'), [period, otherSite]);
  });

  it('fails a patch whose read fails rather than saving over the stored context', async () => {
    const { service, store } = contextStateService();
    await service.putContextState('user', { slug: 'graph', context: [site, period] });
    const failing = new ContextStateService(
      {
        getOrThrow: async () => {
          throw new Error('redis down');
        },
        set: async (key: string, value: unknown) => {
          store.set(key, value);
        },
      } as unknown as CacheService,
      { get: () => undefined } as unknown as ConfigService,
    );
    await assert.rejects(failing.patchContextState('user', { slug: 'graph', context: [site] }));
    assert.deepEqual(store.get('context-state:user:graph'), [site, period]);
  });

  it('keeps the last condition per field when one body repeats a field', async () => {
    const { service } = contextStateService();
    const otherSite: FilterCondition = { field: 'site', operator: 'equals', value: 'site-2' };
    await service.putContextState('user', { slug: 'graph', context: [site, period, otherSite] });
    assert.deepEqual(await service.getContextState('user', 'graph'), [otherSite, period]);
    await service.patchContextState('user', { slug: 'graph', context: [site, otherSite] });
    assert.deepEqual(await service.getContextState('user', 'graph'), [period, otherSite]);
  });
});

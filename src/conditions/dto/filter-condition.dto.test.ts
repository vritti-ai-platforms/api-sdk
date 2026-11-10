import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PatchContextStateDto } from '../../context-state/dto/request/patch-context-state.dto';
import { PutContextStateDto } from '../../context-state/dto/request/put-context-state.dto';
import { PatchTableStateDto } from '../../data-table/state/dto/request/patch-table-state.dto';

const site = { field: 'site', operator: 'equals', value: '01a1835b-abf5-78a6-ad65-966b842e5590' };
const period = { field: 'period', operator: 'between', value: ['2026-09-01', '2026-12-01'] };
const amount = { field: 'unitPrice', operator: 'gt', value: 100 };

// Converts and validates a body the way the apps' global ValidationPipe does
function check<T extends object>(dto: new () => T, body: object): { value: T; errors: string[] } {
  const value = plainToInstance(dto, body, { enableImplicitConversion: true });
  const errors = validateSync(value, { whitelist: true, forbidNonWhitelisted: true });
  const messages = (list: typeof errors): string[] =>
    list.flatMap((error) => [...Object.values(error.constraints ?? {}), ...messages(error.children ?? [])]);
  return { value, errors: messages(errors) };
}

describe('context conditions in request bodies', () => {
  it('keeps every condition intact through implicit conversion', () => {
    const { value, errors } = check(PutContextStateDto, { slug: 'graph', context: [site, period, amount] });
    assert.deepEqual(errors, []);
    assert.deepEqual(JSON.parse(JSON.stringify(value.context)), [site, period, amount]);
  });

  it('accepts a table context patch', () => {
    assert.deepEqual(check(PatchTableStateDto, { tableSlug: 'prices', context: [site] }).errors, []);
  });

  it('rejects an unknown operator, a malformed value and an unknown key', () => {
    const { errors } = check(PatchContextStateDto, {
      slug: 'graph',
      context: [
        { field: 'site', operator: 'near', value: 'x' },
        { field: 'site', operator: 'equals', value: { id: 'x' } },
        { ...site, extra: true },
      ],
    });
    assert.equal(errors.length, 3);
  });

  it('rejects a slug that is not lowercase-kebab', () => {
    for (const slug of ['Graph', 'graph_view', 'graph.view', '-graph', '']) {
      assert.notDeepEqual(check(PutContextStateDto, { slug, context: [] }).errors, [], slug);
    }
    assert.deepEqual(
      check(PutContextStateDto, { slug: 'commerce-le-item-01a1835b-price-history', context: [] }).errors,
      [],
    );
  });

  it('caps how many conditions a context holds and how many values a list holds', () => {
    const tooMany = Array.from({ length: 51 }, (_, index) => ({ ...site, field: `field-${index}` }));
    assert.notDeepEqual(check(PutContextStateDto, { slug: 'graph', context: tooMany }).errors, []);
    const longList = {
      field: 'sites',
      operator: 'isAnyOf',
      value: Array.from({ length: 501 }, (_, index) => `s${index}`),
    };
    assert.notDeepEqual(check(PatchContextStateDto, { slug: 'graph', context: [longList] }).errors, []);
    const fullList = { ...longList, value: longList.value.slice(0, 500) };
    assert.deepEqual(check(PatchContextStateDto, { slug: 'graph', context: [fullList] }).errors, []);
  });
});

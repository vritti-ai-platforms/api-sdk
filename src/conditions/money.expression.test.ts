import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { BadRequestException } from '../exceptions/bad-request.exception';
import type { FilterCondition, FilterOperator } from './condition.types';
import { type FieldMap, FilterProcessor } from './filter.processor';
import { compareMoney } from './money.expression';

const dialect = new PgDialect();
const fieldMap: FieldMap = {
  stockValue: { moneyExpression: compareMoney(sql`(select sum(value) from quants)`, 'INR'), type: 'number' },
  name: { expression: () => sql`name_matches`, type: 'string' },
};
const where = (field: string, operator: FilterOperator, value: FilterCondition['value']) => {
  const condition = FilterProcessor.buildWhere({ panel: [{ field, operator, value }], context: [] }, fieldMap);
  return condition ? dialect.sqlToQuery(condition) : undefined;
};

describe('compareMoney', () => {
  const cases: [FilterOperator, string][] = [
    ['equals', '='],
    ['notEquals', '<>'],
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
  ];
  for (const [operator, symbol] of cases) {
    it(`renders ${operator} as ${symbol} against the minor-unit amount`, () => {
      const q = where('stockValue', operator, { currency: 'INR', value: '1000.50' });
      assert.equal(q?.sql, `(select sum(value) from quants) ${symbol} $1`);
      assert.deepEqual(q?.params, [100050n]);
    });
  }

  it('rejects an amount in another currency or one the currency cannot hold', () => {
    assert.throws(() => where('stockValue', 'gte', { currency: 'USD', value: '10.00' }), BadRequestException);
    assert.throws(() => where('stockValue', 'gte', { currency: 'INR', value: '10.505' }), BadRequestException);
  });

  it('rejects an operator a number filter never sends', () => {
    assert.throws(() => where('stockValue', 'contains', { currency: 'INR', value: '10' }), BadRequestException);
  });

  it('skips a plain value on a money field and an amount on any other field', () => {
    assert.equal(where('stockValue', 'gte', '1000'), undefined);
    assert.equal(where('name', 'equals', { currency: 'INR', value: '10' }), undefined);
  });
});

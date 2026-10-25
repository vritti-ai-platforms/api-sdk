import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { compareCount } from './count.expression';
import { type FieldMap, FilterProcessor } from './filter.processor';
import type { FilterCondition, FilterOperator } from './filter.types';

const dialect = new PgDialect();
const fieldMap: FieldMap = {
  lineCount: { expression: compareCount(sql`(select count(*) from lines)`), type: 'number' },
};
const where = (operator: FilterOperator, value: FilterCondition['value']) => {
  const condition = FilterProcessor.buildWhere([{ field: 'lineCount', operator, value }], fieldMap);
  return condition ? dialect.sqlToQuery(condition) : undefined;
};

describe('compareCount', () => {
  const cases: [FilterOperator, string][] = [
    ['equals', '='],
    ['notEquals', '<>'],
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
  ];
  for (const [operator, symbol] of cases) {
    it(`renders ${operator} as ${symbol} against the count, with the value as a number param`, () => {
      const q = where(operator, '3');
      assert.equal(q?.sql, `(select count(*) from lines) ${symbol} $1`);
      assert.deepEqual(q?.params, [3]);
    });
  }

  it('matches everything for an operator a number filter never sends', () => {
    assert.equal(where('contains', '3')?.sql, 'true');
  });

  it('matches everything for an empty value or one that is not a number, rather than sending 0 or NaN to SQL', () => {
    assert.equal(where('gt', 'abc')?.sql, 'true');
    assert.equal(where('gt', '')?.sql, 'true');
  });
});

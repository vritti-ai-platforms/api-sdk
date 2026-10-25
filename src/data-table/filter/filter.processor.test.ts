import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { inArray, sql } from 'drizzle-orm';
import { boolean, PgDialect, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { type FieldMap, FilterProcessor, isUuid, type MultiValueOperator, type Uuid } from './filter.processor';
import type { FilterCondition } from './filter.types';

const variants = pgTable('variants', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 100 }),
  isActive: boolean('is_active'),
});

const DIMENSION = '019a7c2e-6c21-7e52-8b4f-2a3b4c5d6e71';
const VALUE_A = '019a7c2e-7d32-7f63-9c50-3b4c5d6e7f82';
const VALUE_B = '019a7c2e-7d32-7f63-9c50-3b4c5d6e7f83';

const dialect = new PgDialect();
const where = (filters: FilterCondition[], fieldMap: FieldMap) => {
  const condition = FilterProcessor.buildWhere(filters, fieldMap);
  return condition ? dialect.sqlToQuery(condition) : undefined;
};

describe('FilterProcessor.buildWhere — multiExpression', () => {
  const seen: { values: string[]; operator: MultiValueOperator }[] = [];
  const fieldMap: FieldMap = {
    valueId: {
      multiExpression: (values, operator) => {
        seen.push({ values, operator });
        return inArray(variants.id, values);
      },
      type: 'string',
    },
  };

  it('passes every picked value and the operator through', () => {
    seen.length = 0;
    const q = where([{ field: 'valueId', operator: 'isAnyOf', value: ['a', 'b'] }], fieldMap);
    assert.deepEqual(seen, [{ values: ['a', 'b'], operator: 'isAnyOf' }]);
    assert.match(q?.sql ?? '', /"id" in \(\$1, \$2\)/);
    assert.deepEqual(q?.params, ['a', 'b']);
  });

  it('reads a single pick as a one-value list, and equals / notEquals as isAnyOf / isNotAnyOf', () => {
    seen.length = 0;
    where([{ field: 'valueId', operator: 'equals', value: 'a' }], fieldMap);
    where([{ field: 'valueId', operator: 'notEquals', value: 'b' }], fieldMap);
    assert.deepEqual(seen, [
      { values: ['a'], operator: 'isAnyOf' },
      { values: ['b'], operator: 'isNotAnyOf' },
    ]);
  });

  it('adds no condition for an empty pick or an operator a multi-select never sends', () => {
    seen.length = 0;
    assert.equal(where([{ field: 'valueId', operator: 'isAnyOf', value: [] }], fieldMap), undefined);
    assert.equal(where([{ field: 'valueId', operator: 'gt', value: ['a'] }], fieldMap), undefined);
    assert.deepEqual(seen, []);
  });
});

describe('FilterProcessor.buildWhere — expression (unchanged)', () => {
  it('still drops an array and still receives a scalar', () => {
    const received: (string | number)[] = [];
    const fieldMap: FieldMap = {
      supplier: {
        expression: (value) => {
          received.push(value);
          return sql`true`;
        },
        type: 'string',
      },
    };
    assert.equal(where([{ field: 'supplier', operator: 'isAnyOf', value: ['a'] }], fieldMap), undefined);
    where([{ field: 'supplier', operator: 'equals', value: 'x' }], fieldMap);
    assert.deepEqual(received, ['x']);
  });
});

describe('FilterProcessor.buildWhere — wildcard fields', () => {
  const calls: { entry: string; key: string; values: string[]; operator: MultiValueOperator }[] = [];
  const fieldMap: FieldMap = {
    'dimension.*': {
      wildcardExpression: ({ key, values, operator }) => {
        const dimensionId: Uuid = key;
        const valueIds: Uuid[] = values;
        calls.push({ entry: 'dimension', key: dimensionId, values: valueIds, operator });
        return sql`true`;
      },
      keyFormat: 'uuid',
      valueFormat: 'uuid',
      type: 'string',
    },
    'tag.*': {
      wildcardExpression: ({ key, values, operator }) => {
        calls.push({ entry: 'tag', key, values, operator });
        return sql`true`;
      },
      keyFormat: 'string',
      valueFormat: 'string',
      type: 'string',
    },
    'a.*': {
      wildcardExpression: ({ key, values, operator }) => {
        calls.push({ entry: 'a', key, values, operator });
        return sql`true`;
      },
      keyFormat: 'string',
      valueFormat: 'string',
      type: 'string',
    },
    'a.b.*': {
      wildcardExpression: ({ key, values, operator }) => {
        calls.push({ entry: 'a.b', key, values, operator });
        return sql`true`;
      },
      keyFormat: 'string',
      valueFormat: 'string',
      type: 'string',
    },
    exactWildcard: {
      wildcardExpression: ({ key, values, operator }) => {
        calls.push({ entry: 'exactWildcard', key, values, operator });
        return sql`true`;
      },
      keyFormat: 'string',
      valueFormat: 'string',
      type: 'string',
    },
    'colour.*': { column: variants.code, type: 'string' },
    isActive: { column: variants.isActive, type: 'boolean' },
  };
  const run = (filters: FilterCondition[]) => {
    calls.length = 0;
    return where(filters, fieldMap);
  };

  it('hands the part after the prefix to the expression as its key', () => {
    run([{ field: `dimension.${DIMENSION}`, operator: 'isAnyOf', value: [VALUE_A, VALUE_B] }]);
    assert.deepEqual(calls, [{ entry: 'dimension', key: DIMENSION, values: [VALUE_A, VALUE_B], operator: 'isAnyOf' }]);
  });

  it('skips a uuid-format key that is not a uuid, before the expression runs', () => {
    assert.equal(run([{ field: "dimension.x' or 1=1 --", operator: 'isAnyOf', value: [VALUE_A] }]), undefined);
    assert.deepEqual(calls, []);
  });

  it('drops uuid-format values that are not uuids, and skips the filter when none are left', () => {
    run([{ field: `dimension.${DIMENSION}`, operator: 'isAnyOf', value: [VALUE_A, 'nope'] }]);
    assert.deepEqual(calls[0]?.values, [VALUE_A]);
    assert.equal(run([{ field: `dimension.${DIMENSION}`, operator: 'isAnyOf', value: ['nope'] }]), undefined);
    assert.deepEqual(calls, []);
  });

  it('passes string-format keys and values through as they are', () => {
    run([{ field: 'tag.any key', operator: 'isNotAnyOf', value: ['x', 'y'] }]);
    assert.deepEqual(calls, [{ entry: 'tag', key: 'any key', values: ['x', 'y'], operator: 'isNotAnyOf' }]);
  });

  it('accepts any separator before the *, so filter names can avoid dots', () => {
    const colonMap: FieldMap = {
      'dimension:*': {
        wildcardExpression: ({ key, values, operator }) => {
          calls.push({ entry: 'colon', key, values, operator });
          return sql`true`;
        },
        keyFormat: 'uuid',
        valueFormat: 'uuid',
        type: 'string',
      },
    };
    calls.length = 0;
    where([{ field: `dimension:${DIMENSION}`, operator: 'isAnyOf', value: [VALUE_A] }], colonMap);
    assert.deepEqual(calls, [{ entry: 'colon', key: DIMENSION, values: [VALUE_A], operator: 'isAnyOf' }]);
  });

  it('prefers the longest matching wildcard', () => {
    run([{ field: 'a.b.c', operator: 'isAnyOf', value: ['v'] }]);
    assert.deepEqual(
      calls.map((call) => `${call.entry}:${call.key}`),
      ['a.b:c'],
    );
  });

  it('skips a field that only shares the prefix text, or has nothing after it', () => {
    assert.equal(run([{ field: `dimensionx.${DIMENSION}`, operator: 'isAnyOf', value: [VALUE_A] }]), undefined);
    assert.equal(run([{ field: 'dimension.', operator: 'isAnyOf', value: [VALUE_A] }]), undefined);
    assert.deepEqual(calls, []);
  });

  it('never answers a wildcard definition through an exact key, nor a column definition through a .* key', () => {
    assert.equal(run([{ field: 'exactWildcard', operator: 'isAnyOf', value: ['v'] }]), undefined);
    assert.equal(run([{ field: 'colour.red', operator: 'isAnyOf', value: ['v'] }]), undefined);
    assert.deepEqual(calls, []);
  });

  it('skips a condition with no usable field instead of throwing', () => {
    const malformed = [
      { operator: 'isAnyOf', value: ['v'] },
      { field: null, operator: 'isAnyOf', value: ['v'] },
      { field: '', operator: 'isAnyOf', value: ['v'] },
    ] as unknown as FilterCondition[];
    assert.equal(run(malformed), undefined);
    assert.deepEqual(calls, []);
  });

  it('leaves column fields untouched alongside wildcards', () => {
    const q = run([{ field: 'isActive', operator: 'equals', value: 'true' }]);
    assert.match(q?.sql ?? '', /"is_active" = \$1/);
    assert.deepEqual(q?.params, [true]);
  });
});

describe('isUuid', () => {
  it('accepts a canonical uuid and rejects anything else', () => {
    assert.equal(isUuid(DIMENSION), true);
    assert.equal(isUuid('019a7c2e6c217e528b4f2a3b4c5d6e71'), false);
    assert.equal(isUuid("x' or 1=1 --"), false);
    assert.equal(isUuid(''), false);
  });
});

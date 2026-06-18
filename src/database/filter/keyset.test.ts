import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PgDialect, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { CursorCodec } from './cursor.codec';
import { type KeysetOrderBy, KeysetProcessor } from './keyset.processor';

const items = pgTable('items', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }),
});

const dialect = new PgDialect();
const toSql = (orderBy: KeysetOrderBy[], values: unknown[]) =>
  dialect.sqlToQuery(KeysetProcessor.buildAfter(orderBy, values));

describe('KeysetProcessor.buildAfter', () => {
  it('single asc column uses > comparison, no OR wrapper', () => {
    const q = toSql([{ column: items.id, direction: 'asc' }], ['abc']);
    assert.match(q.sql, /"id"\s*>\s*\$1/);
    assert.doesNotMatch(q.sql, /\bor\b/i);
    assert.deepEqual(q.params, ['abc']);
  });

  it('single desc column uses < comparison', () => {
    const q = toSql([{ column: items.id, direction: 'desc' }], ['abc']);
    assert.match(q.sql, /"id"\s*<\s*\$1/);
    assert.deepEqual(q.params, ['abc']);
  });

  it('two asc columns expand lexicographically: (a>v) OR (a=v AND b>w)', () => {
    const q = toSql(
      [
        { column: items.name, direction: 'asc' },
        { column: items.id, direction: 'asc' },
      ],
      ['Widget', 'id-1'],
    );
    assert.match(q.sql, /or/i);
    assert.match(q.sql, /"name"\s*>\s*\$1/);
    assert.match(q.sql, /"name"\s*=\s*\$2/);
    assert.match(q.sql, /"id"\s*>\s*\$3/);
    assert.deepEqual(q.params, ['Widget', 'Widget', 'id-1']);
  });

  it('mixed directions: desc primary then asc tie-breaker uses < then >', () => {
    const q = toSql(
      [
        { column: items.createdAt, direction: 'desc' },
        { column: items.id, direction: 'asc' },
      ],
      [new Date('2026-01-01T00:00:00.000Z'), 'id-9'],
    );
    // first group: createdAt < v1 ; second group: createdAt = v2 AND id > v3
    assert.match(q.sql, /"created_at"\s*<\s*\$1/);
    assert.match(q.sql, /"created_at"\s*=\s*\$2/);
    assert.match(q.sql, /"id"\s*>\s*\$3/);
  });
});

describe('CursorCodec', () => {
  it('round-trips primitives in order', () => {
    const encoded = CursorCodec.encode(['Widget', 42, true, 'id-1']);
    assert.equal(typeof encoded, 'string');
    assert.deepEqual(CursorCodec.decode(encoded), ['Widget', 42, true, 'id-1']);
  });

  it('serializes Dates as ISO and rehydrates to Date', () => {
    const d = new Date('2026-06-14T10:30:00.000Z');
    const encoded = CursorCodec.encode([d, 'id-1']);
    const decoded = CursorCodec.decode(encoded);
    assert.ok(decoded[0] instanceof Date);
    assert.equal((decoded[0] as Date).toISOString(), d.toISOString());
    assert.equal(decoded[1], 'id-1');
  });

  it('preserves null values', () => {
    const encoded = CursorCodec.encode([null, 'id-1']);
    assert.deepEqual(CursorCodec.decode(encoded), [null, 'id-1']);
  });

  it('produces a url-safe (base64url) string', () => {
    const encoded = CursorCodec.encode(['a/b+c=d', 'id-1']);
    assert.doesNotMatch(encoded, /[+/=]/);
  });
});

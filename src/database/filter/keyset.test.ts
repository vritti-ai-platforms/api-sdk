import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PgDialect, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { InvalidCursorException } from '../../exceptions';
import { CursorCodec } from './cursor.codec';
import { type KeysetOrderBy, KeysetProcessor, keysetSignature } from './keyset.processor';

const items = pgTable('items', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }),
});

const dialect = new PgDialect();
const toSql = (orderBy: KeysetOrderBy[], values: unknown[]) => dialect.sqlToQuery(KeysetProcessor.buildAfter(orderBy, values));

describe('KeysetProcessor.buildAfter', () => {
  it('single asc column uses > comparison, no OR/tuple wrapper', () => {
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

  it('two uniform asc columns use a row-value tuple comparison (fast path), no OR', () => {
    const q = toSql(
      [
        { column: items.name, direction: 'asc' },
        { column: items.id, direction: 'asc' },
      ],
      ['Widget', 'id-1'],
    );
    // (name, id) > ($1, $2)
    assert.match(q.sql, /\(.*"name".*,.*"id".*\)\s*>\s*\(/);
    assert.doesNotMatch(q.sql, /\bor\b/i);
    assert.deepEqual(q.params, ['Widget', 'id-1']);
  });

  it('three uniform desc columns use a row-value tuple with < ', () => {
    const q = toSql(
      [
        { column: items.name, direction: 'desc' },
        { column: items.createdAt, direction: 'desc' },
        { column: items.id, direction: 'desc' },
      ],
      ['Widget', new Date('2026-01-01T00:00:00.000Z'), 'id-1'],
    );
    assert.match(q.sql, /\(.*"name".*"created_at".*"id".*\)\s*<\s*\(\s*\$1,\s*\$2,\s*\$3\s*\)/);
    assert.doesNotMatch(q.sql, /\bor\b/i);
  });

  it('mixed directions fall back to OR-expansion: desc primary then asc tie-breaker', () => {
    const q = toSql(
      [
        { column: items.createdAt, direction: 'desc' },
        { column: items.id, direction: 'asc' },
      ],
      [new Date('2026-01-01T00:00:00.000Z'), 'id-9'],
    );
    // first group: created_at < $1 ; second group: created_at = $2 AND id > $3
    assert.match(q.sql, /or/i);
    assert.match(q.sql, /"created_at"\s*<\s*\$1/);
    assert.match(q.sql, /"created_at"\s*=\s*\$2/);
    assert.match(q.sql, /"id"\s*>\s*\$3/);
  });

  it('nullable sort column (nulls last) adds an IS NULL branch to the boundary', () => {
    // name is nullable here; declaring nulls forces the NULL-aware OR-expansion (not the fast path).
    const q = toSql(
      [
        { column: items.name, direction: 'asc', nulls: 'last' },
        { column: items.id, direction: 'asc' },
      ],
      ['Widget', 'id-1'],
    );
    assert.match(q.sql, /"name"\s*>\s*\$1/);
    assert.match(q.sql, /"name"\s+is\s+null/i);
    assert.match(q.sql, /or/i);
  });

  it('empty order by yields a trivially-true predicate', () => {
    const q = toSql([], []);
    assert.match(q.sql, /true/i);
  });
});

describe('keysetSignature', () => {
  it('is stable and encodes field + direction order', () => {
    assert.equal(
      keysetSignature([
        { key: 'createdAt', direction: 'desc' },
        { key: 'id', direction: 'asc' },
      ]),
      'createdAt:desc,id:asc',
    );
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

  it('produces a url-safe string (no +/=)', () => {
    const encoded = CursorCodec.encode(['a/b+c=d', 'id-1']);
    assert.doesNotMatch(encoded, /[+/=]/);
  });

  it('round-trips under a matching sort signature', () => {
    const sig = 'createdAt:desc,id:asc';
    const encoded = CursorCodec.encode([new Date('2026-01-01T00:00:00.000Z'), 'id-1'], sig);
    assert.deepEqual(CursorCodec.decode(encoded, sig).length, 2);
  });

  it('rejects a malformed cursor with InvalidCursorException (400)', () => {
    assert.throws(() => CursorCodec.decode('not-a-real-cursor'), InvalidCursorException);
  });

  it('rejects a tampered body (HMAC mismatch)', () => {
    const encoded = CursorCodec.encode(['Widget', 'id-1']);
    const dot = encoded.lastIndexOf('.');
    // flip a character in the signed body
    const tampered = `${encoded.slice(0, 3) === 'AAA' ? 'BBB' : 'AAA'}${encoded.slice(3, dot)}${encoded.slice(dot)}`;
    assert.throws(() => CursorCodec.decode(tampered), InvalidCursorException);
  });

  it('rejects a cursor minted for a different sort (signature mismatch)', () => {
    const encoded = CursorCodec.encode(['Widget', 'id-1'], 'name:asc,id:asc');
    assert.throws(() => CursorCodec.decode(encoded, 'createdAt:desc,id:asc'), InvalidCursorException);
  });
});

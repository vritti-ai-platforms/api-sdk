import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import type { PrimaryDatabaseService } from '../services/primary-database.service';
import { PrimaryBaseRepository } from './primary-base.repository';

const products = pgTable('products', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 100 }),
});
const items = pgTable('items', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 100 }),
  productId: uuid('product_id'),
});

class ItemsRepository extends PrimaryBaseRepository<typeof items> {}

// Records every statement the repository sends and answers each with the rows `answer` gives it (none by default), as
// arrays in the selected columns' order — how Drizzle reads a select
function recordingRepository(answer: (statement: string) => unknown[][] = () => []) {
  const statements: string[] = [];
  const client = {
    query: async (query: { text: string } | string) => {
      const text = typeof query === 'string' ? query : query.text;
      statements.push(text);
      const rows = answer(text);
      return { rows, fields: [], rowCount: rows.length };
    },
  };
  const database = { drizzleClient: drizzle({ client: client as never }) } as unknown as PrimaryDatabaseService;
  return { repository: new ItemsRepository(database, items), statements };
}

const joinProducts = [{ table: products, on: eq(products.id, items.productId), type: 'inner' as const }];

describe('PrimaryBaseRepository.findForSelect — search', () => {
  it('searches the label column when no searchKeys are given', async () => {
    const { repository, statements } = recordingRepository();
    await repository.findForSelect({ value: 'id', label: 'code', search: 'abc' });
    assert.match(statements[0] ?? '', /"items"\."code" ilike \$\d/);
    assert.doesNotMatch(statements[0] ?? '', /\bor\b/i);
  });

  it('searches every searchKeys column, including one on a joined table', async () => {
    const { repository, statements } = recordingRepository();
    await repository.findForSelect({
      value: 'id',
      label: 'name',
      search: 'abc',
      searchKeys: ['name', 'code'],
      joins: joinProducts,
    });
    assert.match(statements[0] ?? '', /\(\("products"\."name" ilike \$\d+\) or \("items"\."code" ilike \$\d+\)\)/);
  });

  it('adds no search condition without a search term', async () => {
    const { repository, statements } = recordingRepository();
    await repository.findForSelect({ value: 'id', label: 'code', searchKeys: ['code'] });
    assert.doesNotMatch(statements[0] ?? '', /ilike/);
  });

  it('rejects a searchKeys column that is on neither the table nor its joins', async () => {
    const { repository } = recordingRepository();
    await assert.rejects(
      repository.findForSelect({ value: 'id', label: 'code', search: 'abc', searchKeys: ['missing'] }),
      /Search column 'missing' not found/,
    );
  });
});

describe('PrimaryBaseRepository.delete', () => {
  it('deletes by ID alone without a where', async () => {
    const { repository, statements } = recordingRepository();
    await assert.rejects(repository.delete('item-1'), /returned no record/);
    assert.match(statements[0] ?? '', /delete from "items" where "items"\."id" = \$1 returning/);
  });

  it('deletes by ID only while the row also matches the where', async () => {
    const { repository, statements } = recordingRepository();
    await assert.rejects(repository.delete('item-1', eq(items.code, 'open')), /returned no record/);
    assert.match(statements[0] ?? '', /where \(\("items"\."id" = \$1\) and \("items"\."code" = \$2\)\) returning/);
  });
});

describe('PrimaryBaseRepository.findAllAndCount', () => {
  const isCount = (statement: string) => statement.startsWith('select count(*)::int');

  it('counts beside the page by default', async () => {
    const { repository, statements } = recordingRepository((statement) =>
      isCount(statement) ? [[7]] : [['item-1', 'A', null]],
    );
    const page = await repository.findAllAndCount({ limit: 1 });
    assert.equal(statements.length, 2);
    assert.ok(statements.some(isCount));
    assert.ok(statements.every((statement) => !statement.includes('over ()')));
    assert.deepEqual(page, { result: [{ id: 'item-1', code: 'A', productId: null }], count: 7 });
  });

  it('counts with the page in one query in window mode, and drops the total from the rows', async () => {
    const { repository, statements } = recordingRepository(() => [
      ['item-1', 'A', null, '12'],
      ['item-2', 'B', null, '12'],
    ]);
    const page = await repository.findAllAndCount({ countMode: 'window', limit: 2 });
    assert.equal(statements.length, 1);
    assert.match(statements[0] ?? '', /count\(\*\) over \(\)/);
    assert.deepEqual(page, {
      result: [
        { id: 'item-1', code: 'A', productId: null },
        { id: 'item-2', code: 'B', productId: null },
      ],
      count: 12,
    });
  });

  it('keeps a custom select and its joins in window mode', async () => {
    const { repository, statements } = recordingRepository(() => [['A', 'Widget', '3']]);
    const page = await repository.findAllAndCount<{ code: string; name: string }>({
      countMode: 'window',
      select: { code: items.code, name: products.name },
      innerJoin: { table: products, on: eq(products.id, items.productId) },
      where: eq(products.name, 'Widget'),
    });
    assert.match(statements[0] ?? '', /inner join "products"/);
    assert.deepEqual(page, { result: [{ code: 'A', name: 'Widget' }], count: 3 });
  });

  it('reports no rows on an empty first page in window mode without counting again', async () => {
    const { repository, statements } = recordingRepository();
    const page = await repository.findAllAndCount({ countMode: 'window', limit: 20 });
    assert.equal(statements.length, 1);
    assert.deepEqual(page, { result: [], count: 0 });
  });

  it('counts on its own for a page past the end in window mode', async () => {
    const { repository, statements } = recordingRepository((statement) => (isCount(statement) ? [[40]] : []));
    const page = await repository.findAllAndCount({ countMode: 'window', limit: 20, offset: 60 });
    assert.equal(statements.length, 2);
    assert.ok(isCount(statements[1] ?? ''));
    assert.deepEqual(page, { result: [], count: 40 });
  });
});

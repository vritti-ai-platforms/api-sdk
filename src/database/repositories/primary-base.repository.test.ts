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

// Records every statement the repository sends and answers with no rows
function recordingRepository() {
  const statements: string[] = [];
  const client = {
    query: async (query: { text: string } | string) => {
      statements.push(typeof query === 'string' ? query : query.text);
      return { rows: [], fields: [], rowCount: 0 };
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

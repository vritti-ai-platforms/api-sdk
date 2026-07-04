import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { hashSnapshot } from './hash';

describe('hashSnapshot', () => {
  it('yields the same sha256 hex for key-order variants', () => {
    const h1 = hashSnapshot({ b: 2, a: 1 });
    const h2 = hashSnapshot({ a: 1, b: 2 });
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/);
  });

  it('changes when a value changes', () => {
    assert.notEqual(hashSnapshot({ a: 1 }), hashSnapshot({ a: 2 }));
  });
});

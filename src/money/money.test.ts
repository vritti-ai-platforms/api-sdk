import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { allocateByWeight, convertMinor } from './money';

describe('convertMinor', () => {
  it('converts at the rate within one exponent', () => {
    assert.equal(convertMinor(10_000n, 'USD', 'INR', '83.25'), 832_500n);
  });

  it('rescales between exponents', () => {
    assert.equal(convertMinor(1_000n, 'INR', 'JPY', '1.8'), 18n);
    assert.equal(convertMinor(1_000n, 'INR', 'KWD', '0.0037'), 37n);
  });

  it('rounds half up', () => {
    assert.equal(convertMinor(1n, 'INR', 'INR', '0.5'), 1n);
    assert.equal(convertMinor(1n, 'INR', 'INR', '0.49'), 0n);
  });
});

describe('allocateByWeight', () => {
  it('sums to exactly the total', () => {
    const parts = allocateByWeight(100n, [1, 1, 1]);
    assert.deepEqual(parts, [34n, 33n, 33n]);
    assert.equal(
      parts.reduce((sum, part) => sum + part, 0n),
      100n,
    );
  });

  it('gives the leftover units to the largest remainders', () => {
    assert.deepEqual(allocateByWeight(10n, ['0.3', '0.3', '0.4']), [3n, 3n, 4n]);
    assert.deepEqual(allocateByWeight(7n, [2, 1]), [5n, 2n]);
  });

  it('splits evenly when the weights add up to nothing, and returns nothing without parts', () => {
    assert.deepEqual(allocateByWeight(50n, [0, 0]), [25n, 25n]);
    assert.deepEqual(allocateByWeight(10_000n, [0, 0, 0]), [3334n, 3333n, 3333n]);
    assert.deepEqual(allocateByWeight(50n, []), []);
  });
});

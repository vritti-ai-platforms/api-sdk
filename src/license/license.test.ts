import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { canonicalStringify, hashSnapshot } from './canonical';
import { generateLicenseKeyPair, signDocument, verifyDocument } from './signing';

describe('canonicalStringify', () => {
  it('is invariant to object key order, recursively', () => {
    const a = { b: 2, a: 1, nested: { y: [3, { z: 1, x: 2 }], x: 'v' } };
    const b = { nested: { x: 'v', y: [3, { x: 2, z: 1 }] }, a: 1, b: 2 };
    assert.equal(canonicalStringify(a), canonicalStringify(b));
  });

  it('preserves array order', () => {
    assert.notEqual(canonicalStringify({ a: [1, 2] }), canonicalStringify({ a: [2, 1] }));
  });

  it('produces sorted-key JSON', () => {
    assert.equal(canonicalStringify({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
  });
});

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

describe('sign/verify', () => {
  const { privateKey, publicKey } = generateLicenseKeyPair();

  it('roundtrips: signed document verifies against the public key', () => {
    const doc = signDocument({ orgId: 'org-1', planCode: 'PRO' }, privateKey);
    assert.equal(verifyDocument(doc, publicKey), true);
  });

  it('verifies regardless of payload key order', () => {
    const doc = signDocument({ a: 1, b: 2 }, privateKey);
    const reordered = { payload: { b: 2, a: 1 }, signature: doc.signature };
    assert.equal(verifyDocument(reordered, publicKey), true);
  });

  it('fails when the payload is tampered', () => {
    const doc = signDocument({ orgId: 'org-1', planCode: 'PRO' }, privateKey);
    const tampered = { payload: { ...doc.payload, planCode: 'ENTERPRISE' }, signature: doc.signature };
    assert.equal(verifyDocument(tampered, publicKey), false);
  });

  it('fails against a different public key', () => {
    const other = generateLicenseKeyPair();
    const doc = signDocument({ orgId: 'org-1' }, privateKey);
    assert.equal(verifyDocument(doc, other.publicKey), false);
  });

  it('returns false (not throw) on malformed signature or key', () => {
    const doc = signDocument({ a: 1 }, privateKey);
    assert.equal(verifyDocument({ payload: doc.payload, signature: 'not-base64-!!' }, publicKey), false);
    assert.equal(verifyDocument(doc, 'bogus-key'), false);
  });
});

import { strict as assert } from 'node:assert';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { describe, it } from 'node:test';
import { canonicalStringify } from './canonical';
import { generateSigningKeyPair, signDocument, verifyDocument } from './document';
import { buildRequestCanonical, signRequestHeaders, verifySignedRequest } from './request';

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

describe('sign/verify', () => {
  const { privateKey, publicKey } = generateSigningKeyPair();

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
    const other = generateSigningKeyPair();
    const doc = signDocument({ orgId: 'org-1' }, privateKey);
    assert.equal(verifyDocument(doc, other.publicKey), false);
  });

  it('returns false (not throw) on malformed signature or key', () => {
    const doc = signDocument({ a: 1 }, privateKey);
    assert.equal(verifyDocument({ payload: doc.payload, signature: 'not-base64-!!' }, publicKey), false);
    assert.equal(verifyDocument(doc, 'bogus-key'), false);
  });
});

describe('request signing', () => {
  const { privateKey, publicKey } = generateSigningKeyPair();
  const body = JSON.stringify({ hello: 'world' });

  it('builds the canonical string as METHOD, path, orgId, body hash, timestamp', () => {
    const canonical = buildRequestCanonical({
      method: 'post',
      path: '/catalog/internal',
      orgId: 'org-1',
      body,
      timestamp: 1700000000,
    });
    const lines = canonical.split('\n');
    assert.equal(lines.length, 5);
    assert.equal(lines[0], 'POST');
    assert.equal(lines[1], '/catalog/internal');
    assert.equal(lines[2], 'org-1');
    const bodyHashLine = lines[3];
    assert.ok(bodyHashLine, 'canonical string has a body-hash line');
    assert.match(bodyHashLine, /^[0-9a-f]{64}$/);
    assert.equal(lines[4], '1700000000');
  });

  it('hashes the empty string when there is no body and blanks a missing orgId', () => {
    const canonical = buildRequestCanonical({ method: 'GET', path: '/health', timestamp: 1 });
    const lines = canonical.split('\n');
    assert.equal(lines[2], '');
    assert.equal(lines[3], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('roundtrips: signed headers verify against the public key', () => {
    const headers = signRequestHeaders({ method: 'POST', path: '/catalog/internal', orgId: 'org-1', body }, privateKey);
    const ok = verifySignedRequest({
      method: 'POST',
      path: '/catalog/internal',
      orgId: 'org-1',
      rawBody: body,
      timestamp: headers['x-timestamp'],
      signature: headers['x-signature'],
      publicKey,
    });
    assert.equal(ok, true);
  });

  it('roundtrips without a body or orgId', () => {
    const headers = signRequestHeaders({ method: 'DELETE', path: '/organization/org-1' }, privateKey);
    const ok = verifySignedRequest({
      method: 'DELETE',
      path: '/organization/org-1',
      timestamp: headers['x-timestamp'],
      signature: headers['x-signature'],
      publicKey,
    });
    assert.equal(ok, true);
  });

  it('fails when method, path, orgId, or body is tampered', () => {
    const headers = signRequestHeaders({ method: 'POST', path: '/catalog/internal', orgId: 'org-1', body }, privateKey);
    const base = { timestamp: headers['x-timestamp'], signature: headers['x-signature'], publicKey };
    assert.equal(
      verifySignedRequest({ ...base, method: 'PUT', path: '/catalog/internal', orgId: 'org-1', rawBody: body }),
      false,
    );
    assert.equal(
      verifySignedRequest({ ...base, method: 'POST', path: '/other', orgId: 'org-1', rawBody: body }),
      false,
    );
    assert.equal(
      verifySignedRequest({ ...base, method: 'POST', path: '/catalog/internal', orgId: 'org-2', rawBody: body }),
      false,
    );
    assert.equal(
      verifySignedRequest({
        ...base,
        method: 'POST',
        path: '/catalog/internal',
        orgId: 'org-1',
        rawBody: '{"hello":"there"}',
      }),
      false,
    );
  });

  it('fails against a different public key', () => {
    const other = generateSigningKeyPair();
    const headers = signRequestHeaders({ method: 'GET', path: '/x' }, privateKey);
    const ok = verifySignedRequest({
      method: 'GET',
      path: '/x',
      timestamp: headers['x-timestamp'],
      signature: headers['x-signature'],
      publicKey: other.publicKey,
    });
    assert.equal(ok, false);
  });

  it('rejects timestamps outside the allowed skew', () => {
    const stale = Math.floor(Date.now() / 1000) - 301;
    const canonical = buildRequestCanonical({ method: 'GET', path: '/x', timestamp: stale });
    const key = createPrivateKey({ key: Buffer.from(privateKey, 'base64'), format: 'der', type: 'pkcs8' });
    const signature = sign(null, Buffer.from(canonical, 'utf8'), key).toString('base64');
    assert.equal(verifySignedRequest({ method: 'GET', path: '/x', timestamp: stale, signature, publicKey }), false);
    assert.equal(
      verifySignedRequest({ method: 'GET', path: '/x', timestamp: stale, signature, publicKey, maxSkewSeconds: 600 }),
      true,
    );
  });

  it('returns false on a non-numeric timestamp', () => {
    const headers = signRequestHeaders({ method: 'GET', path: '/x' }, privateKey);
    const ok = verifySignedRequest({
      method: 'GET',
      path: '/x',
      timestamp: 'not-a-number',
      signature: headers['x-signature'],
      publicKey,
    });
    assert.equal(ok, false);
  });
});

describe('cross-language vector', () => {
  // Pinned byte-for-byte against the Go port (agentkit/apisign/request_test.go). A fixed pkcs8 key +
  // request + timestamp yields a deterministic Ed25519 signature (RFC 8032); if either language drifts
  // its canonical string or key handling, one of these assertions breaks first.
  const PRIV_PKCS8_DER_B64 = 'MC4CAQAwBQYDK2VwBCIEIAARIjNEVWZ3iJmqu8zd7v8AESIzRFVmd4iZqrvM3e7/';
  const PUB_SPKI_DER_B64 = 'MCowBQYDK2VwAyEAPM0kHP/Js2GARLl9A22GFFk9iwF8NA8d7odzOFUXZUs=';
  const BODY = '{"hello":"world"}';
  const CANONICAL =
    'POST\n/gitea/internal/credentials\n\n93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588\n1700000000';
  const SIGNATURE_B64 = 'blIAwOVf7jq97x9X1CZ+VsQWohzRuARtP4OYDeLMgZ/F6mag2imrC8zYNeT4Tc4ba9Ah4zVl4EQu2N80a1eYDA==';
  const TS = 1700000000;

  it('derives the pinned SPKI public key from the pinned private key', () => {
    const priv = createPrivateKey({ key: Buffer.from(PRIV_PKCS8_DER_B64, 'base64'), format: 'der', type: 'pkcs8' });
    const pub = createPublicKey(priv).export({ type: 'spki', format: 'der' }).toString('base64');
    assert.equal(pub, PUB_SPKI_DER_B64);
  });

  it('builds the pinned canonical string', () => {
    const canonical = buildRequestCanonical({
      method: 'POST',
      path: '/gitea/internal/credentials',
      body: BODY,
      timestamp: TS,
    });
    assert.equal(canonical, CANONICAL);
  });

  it('produces the pinned signature (matches the Go port)', () => {
    const priv = createPrivateKey({ key: Buffer.from(PRIV_PKCS8_DER_B64, 'base64'), format: 'der', type: 'pkcs8' });
    const sig = sign(null, Buffer.from(CANONICAL, 'utf8'), priv).toString('base64');
    assert.equal(sig, SIGNATURE_B64);
  });

  it('verifySignedRequest accepts the pinned signature under a generous skew', () => {
    const ok = verifySignedRequest({
      method: 'POST',
      path: '/gitea/internal/credentials',
      rawBody: BODY,
      timestamp: TS,
      signature: SIGNATURE_B64,
      publicKey: PUB_SPKI_DER_B64,
      maxSkewSeconds: Number.MAX_SAFE_INTEGER,
    });
    assert.equal(ok, true);
  });
});

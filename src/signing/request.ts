import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export interface RequestCanonicalInput {
  method: string;
  path: string;
  orgId?: string;
  body?: string | Buffer;
  timestamp: number;
}

export interface SignRequestInput {
  method: string;
  path: string;
  orgId?: string;
  body?: string | Buffer;
}

export interface VerifySignedRequestInput {
  method: string;
  path: string;
  orgId?: string;
  rawBody?: string | Buffer;
  timestamp: string | number;
  signature: string;
  publicKey: string;
  maxSkewSeconds?: number;
}

// Builds the canonical string signed for a control-plane request: METHOD\npath\norgId\nsha256hex(body)\ntimestamp
export function buildRequestCanonical(input: RequestCanonicalInput): string {
  const bodyHash = createHash('sha256')
    .update(input.body ?? '')
    .digest('hex');
  return [input.method.toUpperCase(), input.path, input.orgId ?? '', bodyHash, String(input.timestamp)].join('\n');
}

// Signs a request with an Ed25519 private key (base64 pkcs8 DER), stamping the current unix time
export function signRequestHeaders(
  input: SignRequestInput,
  privateKeyBase64: string,
): { 'x-timestamp': string; 'x-signature': string } {
  const timestamp = Math.floor(Date.now() / 1000);
  const canonical = buildRequestCanonical({ ...input, timestamp });
  const key = createPrivateKey({ key: Buffer.from(privateKeyBase64, 'base64'), format: 'der', type: 'pkcs8' });
  const signature = sign(null, Buffer.from(canonical, 'utf8'), key).toString('base64');
  return { 'x-timestamp': String(timestamp), 'x-signature': signature };
}

// Verifies a signed request (signature + timestamp skew) against an Ed25519 public key; malformed input ⇒ false
export function verifySignedRequest(input: VerifySignedRequestInput): boolean {
  try {
    const timestamp = Number(input.timestamp);
    if (!Number.isFinite(timestamp)) return false;
    const maxSkew = input.maxSkewSeconds ?? 300;
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > maxSkew) return false;
    const canonical = buildRequestCanonical({
      method: input.method,
      path: input.path,
      orgId: input.orgId,
      body: input.rawBody,
      timestamp,
    });
    const key = createPublicKey({ key: Buffer.from(input.publicKey, 'base64'), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(canonical, 'utf8'), key, Buffer.from(input.signature, 'base64'));
  } catch {
    return false;
  }
}

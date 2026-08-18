import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

/**
 * The workspace-scope headers, in the order the canonical appends them.
 *
 * Exactly one is expected — the kind of scope *is* which header is sent, the same
 * convention core-web and core-app already use. Signing the header **name** rather
 * than a separate `kind` field means a verifier needs no scope vocabulary: it scans
 * this same list in this same order and rebuilds an identical string.
 *
 * Fixed and shared so a signer and a verifier can never disagree about it, and so the
 * discouraged multi-header case is deterministic rather than ambiguous.
 */
export const WORKSPACE_HEADER_ORDER = ['x-site-id', 'x-sg-id', 'x-le-id', 'x-org-id'] as const;

export interface RequestCanonicalInput {
  method: string;
  path: string;
  orgId?: string;
  body?: string | Buffer;
  timestamp: number;
  /**
   * The raw query string, without the leading `?`.
   *
   * Signed byte for byte, with no sorting or re-encoding, so the signer and the
   * verifier cannot disagree about normalization. The consequence is that a proxy
   * which reorders or re-encodes parameters invalidates the signature.
   */
  query?: string;
  /**
   * The party (person) the request acts for, when there is one.
   *
   * Signed so a caller cannot be swapped for another shopper in transit.
   */
  partyId?: string;
  /**
   * The workspace-scope headers actually present on the request, by header name.
   *
   * Only names in `WORKSPACE_HEADER_ORDER` are considered, and they are appended in
   * that order — so signer and verifier agree without either needing to know what a
   * "site" or a "legal entity" is.
   */
  workspaceHeaders?: Record<string, string | undefined>;
}

export interface SignRequestInput {
  method: string;
  path: string;
  orgId?: string;
  body?: string | Buffer;
  /** Raw query string, without the leading `?`. See `RequestCanonicalInput`. */
  query?: string;
  /**
   * The party (person) the request acts for, when there is one.
   *
   * Signed so a caller cannot be swapped for another shopper in transit.
   */
  partyId?: string;
  /**
   * The workspace-scope headers actually present on the request, by header name.
   *
   * Only names in `WORKSPACE_HEADER_ORDER` are considered, and they are appended in
   * that order — so signer and verifier agree without either needing to know what a
   * "site" or a "legal entity" is.
   */
  workspaceHeaders?: Record<string, string | undefined>;
}

export interface VerifySignedRequestInput {
  method: string;
  path: string;
  orgId?: string;
  /** Raw query string, without the leading `?`. See `RequestCanonicalInput`. */
  query?: string;
  /**
   * The party (person) the request acts for, when there is one.
   *
   * Signed so a caller cannot be swapped for another shopper in transit.
   */
  partyId?: string;
  /**
   * The workspace-scope headers actually present on the request, by header name.
   *
   * Only names in `WORKSPACE_HEADER_ORDER` are considered, and they are appended in
   * that order — so signer and verifier agree without either needing to know what a
   * "site" or a "legal entity" is.
   */
  workspaceHeaders?: Record<string, string | undefined>;
  rawBody?: string | Buffer;
  timestamp: string | number;
  signature: string;
  publicKey: string;
  maxSkewSeconds?: number;
}

/**
 * Builds the canonical string a request's signature is made over:
 * `METHOD\npath\norgId\nsha256hex(body)\ntimestamp`, then a labelled line per
 * optional field that is present.
 *
 * Optional fields are appended **only when set**, so a caller that supplies none
 * produces exactly the string this function has always produced — which is what
 * lets new fields be added without invalidating existing signers. They are
 * **labelled** so that "query present, party absent" can never be confused with
 * "party present, query absent".
 *
 * Absence is still tamper-evident: strip a signed field in transit and the
 * verifier rebuilds the canonical without it, which no longer matches.
 */
export function buildRequestCanonical(input: RequestCanonicalInput): string {
  const bodyHash = createHash('sha256')
    .update(input.body ?? '')
    .digest('hex');

  const lines = [input.method.toUpperCase(), input.path, input.orgId ?? '', bodyHash, String(input.timestamp)];
  if (input.query) lines.push(`query:${input.query}`);
  if (input.partyId) lines.push(`party:${input.partyId}`);

  // Header name and value both go in, so swapping x-le-id for x-site-id on the same
  // value breaks the signature. Fixed order, so multiple headers stay deterministic.
  for (const header of WORKSPACE_HEADER_ORDER) {
    const value = input.workspaceHeaders?.[header];
    if (value) lines.push(`${header}:${value}`);
  }

  return lines.join('\n');
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
      query: input.query,
      partyId: input.partyId,
      workspaceHeaders: input.workspaceHeaders,
      body: input.rawBody,
      timestamp,
    });
    const key = createPublicKey({ key: Buffer.from(input.publicKey, 'base64'), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(canonical, 'utf8'), key, Buffer.from(input.signature, 'base64'));
  } catch {
    return false;
  }
}

export interface NatsHeaders {
  orgId: string;
  userId: string;
  siteId: string;
  legalEntityId: string;
  siteGroupId: string;
  siteTimezone: string;
  siteCurrencyCode: string;
}

// The single source of truth for context transport, both directions. Adding a field means
// adding one entry here plus one on NatsHeaders — encode and parse both pick it up.
export const NATS_HEADER_KEYS = {
  orgId: 'x-org-id',
  userId: 'x-user-id',
  siteId: 'x-site-id',
  legalEntityId: 'x-le-id',
  siteGroupId: 'x-sg-id',
  siteTimezone: 'x-site-timezone',
  siteCurrencyCode: 'x-site-currency-code',
} as const satisfies Record<keyof NatsHeaders, string>;

// Applied when a header is absent, so a missing optional field lands on the same value the
// producing side would have sent for "not set"
const HEADER_FALLBACKS: Partial<Record<keyof NatsHeaders, string>> = {
  siteTimezone: 'UTC',
};

// Reads a header value from either a plain object or a NATS MsgHdrsImpl
function getHeader(headers: unknown, key: string): string | undefined {
  if (!headers) return undefined;
  // MsgHdrsImpl uses .get(), plain objects use bracket access
  if (typeof (headers as { get?: unknown }).get === 'function') {
    const val = (headers as { get(key: string): string[] }).get(key);
    return Array.isArray(val) ? val[0] : (val as string | undefined);
  }
  return (headers as Record<string, string>)[key];
}

/**
 * Parses NATS message headers into a NatsHeaders object.
 *
 * Only `orgId` is required. It is what scopes every row the receiving service will read, so
 * without it there is no safe way to run — the caller returns null and the interceptor decides.
 *
 * `userId` is deliberately NOT required. A control-plane call has no user behind it, and an
 * earlier version rejected the whole context when it was blank — which meant the receiving
 * service skipped RLS entirely, ran with `app.org_id` unset, and matched no rows. Losing the
 * tenant because there was no user is a far worse failure than an empty acting principal.
 */
export function parseNatsHeaders(headers: unknown): NatsHeaders | null {
  if (!headers) return null;

  const orgId = getHeader(headers, NATS_HEADER_KEYS.orgId);
  if (!orgId) return null;

  const parsed = {} as NatsHeaders;
  for (const [field, key] of Object.entries(NATS_HEADER_KEYS) as [keyof NatsHeaders, string][]) {
    parsed[field] = getHeader(headers, key) || HEADER_FALLBACKS[field] || '';
  }
  return parsed;
}

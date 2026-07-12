export interface NatsHeaders {
  orgId: string;
  userId: string;
  siteId: string;
  legalEntityId: string;
  siteGroupId: string;
  siteTimezone: string;
  siteCurrencyCode: string;
}

// Header keys for NATS context transport
export const NATS_HEADER_KEYS = {
  ORG_ID: 'x-org-id',
  USER_ID: 'x-user-id',
  SITE_ID: 'x-site-id',
  LE_ID: 'x-le-id',
  SITE_GROUP_ID: 'x-sg-id',
  SITE_TIMEZONE: 'x-site-timezone',
  SITE_CURRENCY_CODE: 'x-site-currency-code',
} as const;

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

// Parses NATS message headers into a NatsHeaders object — siteId is optional (empty for org-level contexts)
export function parseNatsHeaders(headers: unknown): NatsHeaders | null {
  if (!headers) return null;

  const orgId = getHeader(headers, NATS_HEADER_KEYS.ORG_ID);
  const userId = getHeader(headers, NATS_HEADER_KEYS.USER_ID);

  if (!orgId || !userId) return null;

  return {
    orgId,
    userId,
    siteId: getHeader(headers, NATS_HEADER_KEYS.SITE_ID) || '',
    legalEntityId: getHeader(headers, NATS_HEADER_KEYS.LE_ID) || '',
    siteGroupId: getHeader(headers, NATS_HEADER_KEYS.SITE_GROUP_ID) || '',
    siteTimezone: getHeader(headers, NATS_HEADER_KEYS.SITE_TIMEZONE) || 'UTC',
    siteCurrencyCode: getHeader(headers, NATS_HEADER_KEYS.SITE_CURRENCY_CODE) || '',
  };
}

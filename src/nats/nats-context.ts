export interface NatsHeaders {
  orgId: string;
  userId: string;
  buId: string;
  buTimezone: string;
  buCurrencyCode: string;
  buAncestorIds: string[];
  buDescendantIds: string[];
}

// Header keys for NATS context transport
export const NATS_HEADER_KEYS = {
  ORG_ID: 'x-org-id',
  USER_ID: 'x-user-id',
  BU_ID: 'x-bu-id',
  BU_TIMEZONE: 'x-bu-timezone',
  BU_CURRENCY_CODE: 'x-bu-currency-code',
  BU_ANCESTOR_IDS: 'x-bu-ancestor-ids',
  BU_DESCENDANT_IDS: 'x-bu-descendant-ids',
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

// Parses NATS message headers into a NatsHeaders object
export function parseNatsHeaders(headers: unknown): NatsHeaders | null {
  if (!headers) return null;

  const orgId = getHeader(headers, NATS_HEADER_KEYS.ORG_ID);
  const userId = getHeader(headers, NATS_HEADER_KEYS.USER_ID);
  const buId = getHeader(headers, NATS_HEADER_KEYS.BU_ID);

  if (!orgId || !userId || !buId) return null;

  return {
    orgId,
    userId,
    buId,
    buTimezone: getHeader(headers, NATS_HEADER_KEYS.BU_TIMEZONE) || 'UTC',
    buCurrencyCode: getHeader(headers, NATS_HEADER_KEYS.BU_CURRENCY_CODE) || '',
    buAncestorIds: JSON.parse(getHeader(headers, NATS_HEADER_KEYS.BU_ANCESTOR_IDS) || '[]'),
    buDescendantIds: JSON.parse(getHeader(headers, NATS_HEADER_KEYS.BU_DESCENDANT_IDS) || '[]'),
  };
}

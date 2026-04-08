export interface NatsHeaders {
  orgId: string;
  userId: string;
  buId: string;
  buAncestorIds: string[];
  buDescendantIds: string[];
}

// Header keys for NATS context transport
export const NATS_HEADER_KEYS = {
  ORG_ID: 'x-org-id',
  USER_ID: 'x-user-id',
  BU_ID: 'x-bu-id',
  BU_ANCESTOR_IDS: 'x-bu-ancestor-ids',
  BU_DESCENDANT_IDS: 'x-bu-descendant-ids',
} as const;

// Parses NATS message headers into a NatsHeaders object
export function parseNatsHeaders(headers: Record<string, string> | undefined): NatsHeaders | null {
  if (!headers) return null;

  const orgId = headers[NATS_HEADER_KEYS.ORG_ID];
  const userId = headers[NATS_HEADER_KEYS.USER_ID];
  const buId = headers[NATS_HEADER_KEYS.BU_ID];

  if (!orgId || !userId || !buId) return null;

  return {
    orgId,
    userId,
    buId,
    buAncestorIds: JSON.parse(headers[NATS_HEADER_KEYS.BU_ANCESTOR_IDS] || '[]'),
    buDescendantIds: JSON.parse(headers[NATS_HEADER_KEYS.BU_DESCENDANT_IDS] || '[]'),
  };
}

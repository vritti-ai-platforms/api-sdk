// Parses a duration string (e.g. '10m', '1h', '30s', '7d') to milliseconds
export function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhdwy])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);

  const [, digits = '', unit = ''] = match;
  const value = Number.parseInt(digits, 10);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_536_000_000,
  };

  const multiplier = multipliers[unit];
  if (multiplier === undefined) throw new Error(`Invalid expiry format: ${expiry}`);

  return value * multiplier;
}

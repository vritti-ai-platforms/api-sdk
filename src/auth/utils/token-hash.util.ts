import * as crypto from 'node:crypto';

// Hashes a token using SHA-256
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Verifies a token against its stored hash
export function verifyTokenHash(token: string, expectedHash: string): boolean {
  const computedHash = hashToken(token);
  if (computedHash.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

import * as crypto from 'crypto';

/**
 * Hash a token using SHA-256
 * @param token The token to hash
 * @returns The hex-encoded SHA-256 hash
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its expected hash using constant-time comparison
 * @param token The token to verify
 * @param expectedHash The expected SHA-256 hash
 * @returns true if the token matches the hash
 */
export function verifyTokenHash(token: string, expectedHash: string): boolean {
  const computedHash = hashToken(token);
  if (computedHash.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(expectedHash, 'hex'),
  );
}

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A capability token is shown to its owner once; only its SHA-256 hash is stored. */
export function createAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function safeTokenEquals(candidate: string, expected: string): boolean {
  const left = Buffer.from(hashAccessToken(candidate), 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessToken, hashAccessToken, safeTokenEquals } from '../lib/tokens';

test('creates high-entropy URL-safe tokens and stores verifiable hashes', () => {
  const token = createAccessToken(); const hash = hashAccessToken(token);
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/); assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token); assert.equal(safeTokenEquals(token, hash), true);
  assert.equal(safeTokenEquals(`${token}x`, hash), false);
});
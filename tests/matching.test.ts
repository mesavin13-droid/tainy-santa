import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSecretSantaMatching } from '../lib/matching';

const verifyPerfectMatching = (ids: string[], pairs: ReturnType<typeof makeSecretSantaMatching>) => {
  assert.ok(pairs);
  assert.equal(pairs.length, ids.length);
  assert.equal(new Set(pairs.map((pair) => pair.giver_id)).size, ids.length);
  assert.equal(new Set(pairs.map((pair) => pair.receiver_id)).size, ids.length);
  assert.ok(pairs.every((pair) => pair.giver_id !== pair.receiver_id));
};

test('creates a valid matching for two participants', () => {
  const ids = ['a', 'b']; verifyPerfectMatching(ids, makeSecretSantaMatching(ids, [], () => 0));
});
test('creates a complete matching for a larger even roster', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']; verifyPerfectMatching(ids, makeSecretSantaMatching(ids, [], () => 0));
});
test('creates a complete matching for an odd roster', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']; verifyPerfectMatching(ids, makeSecretSantaMatching(ids, [], () => 0));
});
test('respects directed forbidden pairs', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const restrictions = [{ giver_id: 'a', receiver_id: 'b' }, { giver_id: 'c', receiver_id: 'd' }];
  const pairs = makeSecretSantaMatching(ids, restrictions, () => 0); verifyPerfectMatching(ids, pairs);
  assert.ok(pairs!.every((pair) => !restrictions.some((r) => r.giver_id === pair.giver_id && r.receiver_id === pair.receiver_id)));
});
test('returns null instead of partial assignments when matching is impossible', () => {
  const ids = ['a', 'b', 'c'];
  const restrictions = ids.flatMap((giver_id) => ids.filter((receiver_id) => receiver_id !== giver_id).map((receiver_id) => ({ giver_id, receiver_id })));
  assert.equal(makeSecretSantaMatching(ids, restrictions, () => 0), null);
});
test('rejects one participant and duplicate participant IDs', () => {
  assert.equal(makeSecretSantaMatching(['a']), null); assert.equal(makeSecretSantaMatching(['a', 'a']), null);
});
test('randomized rosters never leak partial or invalid assignments', () => {
  let seed = 0x51a7a;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
  const randomIndex = (max: number) => Math.floor(next() * max);
  for (let size = 2; size <= 14; size += 1) {
    const ids = Array.from({ length: size }, (_, index) => `person-${index}`);
    for (let trial = 0; trial < 12; trial += 1) {
      const restrictions = ids.flatMap((giver_id) => ids.filter((receiver_id) => giver_id !== receiver_id && next() < 0.22).map((receiver_id) => ({ giver_id, receiver_id })));
      const pairs = makeSecretSantaMatching(ids, restrictions, randomIndex);
      if (pairs === null) continue;
      verifyPerfectMatching(ids, pairs);
      assert.ok(pairs.every((pair) => !restrictions.some((r) => r.giver_id === pair.giver_id && r.receiver_id === pair.receiver_id)));
    }
  }
});
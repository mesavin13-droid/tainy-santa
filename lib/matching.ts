import { randomInt } from 'node:crypto';

export type Pair = { giver_id: string; receiver_id: string };
export type ForbiddenPair = { giver_id: string; receiver_id: string };
type RandomInt = (maxExclusive: number) => number;

function shuffled<T>(items: T[], rng: RandomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = rng(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Randomized perfect matching without self-assignment or forbidden directed pairs. */
export function makeSecretSantaMatching(
  participantIds: string[],
  restrictions: ForbiddenPair[] = [],
  rng: RandomInt = (max) => randomInt(0, max),
): Pair[] | null {
  const ids = [...new Set(participantIds)];
  if (ids.length !== participantIds.length || ids.length < 2) return null;
  const idSet = new Set(ids);
  const blocked = new Set<string>();
  for (const restriction of restrictions) {
    if (!idSet.has(restriction.giver_id) || !idSet.has(restriction.receiver_id)) continue;
    blocked.add(`${restriction.giver_id}\u0000${restriction.receiver_id}`);
  }
  const allowed = (giver: string, receiver: string) => giver !== receiver && !blocked.has(`${giver}\u0000${receiver}`);
  const receiversByGiver = new Map(ids.map((giver) => [giver, shuffled(ids.filter((receiver) => allowed(giver, receiver)), rng)]));
  if ([...receiversByGiver.values()].some((receivers) => receivers.length === 0)) return null;
  const giverByReceiver = new Map<string, string>();
  const augment = (giver: string, seenReceivers: Set<string>): boolean => {
    for (const receiver of receiversByGiver.get(giver) ?? []) {
      if (seenReceivers.has(receiver)) continue;
      seenReceivers.add(receiver);
      const previousGiver = giverByReceiver.get(receiver);
      if (!previousGiver || augment(previousGiver, seenReceivers)) {
        giverByReceiver.set(receiver, giver);
        return true;
      }
    }
    return false;
  };
  for (const giver of shuffled(ids, rng)) if (!augment(giver, new Set<string>())) return null;
  if (giverByReceiver.size !== ids.length) return null;
  return shuffled([...giverByReceiver.entries()], rng).map(([receiver_id, giver_id]) => ({ giver_id, receiver_id }));
}
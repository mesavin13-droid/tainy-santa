import type { SupabaseClient } from '@supabase/supabase-js';
import { hashAccessToken, safeTokenEquals } from './tokens';

type Db = SupabaseClient;
export type GameStatus = 'registration' | 'locked' | 'drawn' | 'completed';
export type PublicGameRow = {
  id: string; slug: string; name: string; company_name: string; budget: number;
  exchange_date: string | null; registration_deadline: string | null; rules: string; status: GameStatus;
};
export type ParticipantRow = {
  id: string; game_id: string; display_name: string; department: string; wishlist: string;
  gift_state: 'pending' | 'prepared' | 'delivered'; revealed_at: string | null; created_at: string;
};
type OrganizerGameRow = PublicGameRow & { organizer_token_hash: string };
type AuthFailure = { ok: false; error: string; status: 401 | 404 };
type ParticipantContext = { ok: true; game: PublicGameRow; participant: ParticipantRow } | AuthFailure;
type OrganizerContext = { ok: true; game: OrganizerGameRow } | AuthFailure;

export async function getParticipantContext(db: Db, slug: string, token: string): Promise<ParticipantContext> {
  const { data: game, error: gameError } = await db.from('games')
    .select('id, slug, name, company_name, budget, exchange_date, registration_deadline, rules, status')
    .eq('slug', slug).maybeSingle();
  if (gameError || !game) return { ok: false as const, error: 'Игра не найдена.', status: 404 as const };
  const { data: participant, error: participantError } = await db.from('participants')
    .select('id, game_id, display_name, department, wishlist, gift_state, revealed_at, created_at')
    .eq('game_id', game.id).eq('access_token_hash', hashAccessToken(token)).maybeSingle();
  if (participantError || !participant) return { ok: false as const, error: 'Личная ссылка не найдена или больше недействительна.', status: 401 as const };
  return { ok: true as const, game: game as PublicGameRow, participant: participant as ParticipantRow };
}

export async function getOrganizerGame(db: Db, slug: string, token: string): Promise<OrganizerContext> {
  const { data: game, error } = await db.from('games')
    .select('id, slug, name, company_name, budget, exchange_date, registration_deadline, rules, status, organizer_token_hash')
    .eq('slug', slug).maybeSingle();
  if (error || !game) return { ok: false as const, error: 'Игра не найдена.', status: 404 as const };
  if (!safeTokenEquals(token, game.organizer_token_hash)) return { ok: false as const, error: 'Ссылка организатора недействительна.', status: 401 as const };
  return { ok: true as const, game: game as OrganizerGameRow };
}
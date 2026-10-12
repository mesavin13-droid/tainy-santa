import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/http';
import { getOrganizerGame } from '@/lib/participant-context';
import { readBearerToken } from '@/lib/tokens';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const token = request.headers.get('x-organizer-token') ?? readBearerToken(request.headers.get('authorization'));
  if (!token) return jsonError('Нужна личная ссылка организатора.', 401);
  try {
    const db = getSupabaseAdmin();
    const auth = await getOrganizerGame(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    const game = auth.game;
    const [{ data: participants, error: pError }, { data: restrictions, error: rError }] = await Promise.all([
      db.from('participants').select('id, display_name, department, wishlist, gift_state, created_at').eq('game_id', game.id).order('created_at', { ascending: true }),
      db.from('restrictions').select('id, giver_id, receiver_id').eq('game_id', game.id),
    ]);
    if (pError || rError) return jsonError('Не удалось загрузить панель организатора.', 500);
    return NextResponse.json({ game: { ...game, organizer_token_hash: undefined }, participants: participants ?? [], restrictions: restrictions ?? [] });
  } catch (error) {
    console.error('load admin panel error', error);
    return jsonError('Сервер не настроен: подключите Supabase.', 500);
  }
}

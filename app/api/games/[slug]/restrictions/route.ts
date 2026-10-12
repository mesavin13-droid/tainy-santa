import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError, readJsonObject, textField } from '@/lib/http';
import { getOrganizerGame } from '@/lib/participant-context';
import { readBearerToken } from '@/lib/tokens';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const token = request.headers.get('x-organizer-token') ?? readBearerToken(request.headers.get('authorization'));
  if (!token) return jsonError('Нужна личная ссылка организатора.', 401);
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Проверьте данные ограничения.'); }
  if (!body) return jsonError('Проверьте данные ограничения.');
  const giverId = textField(body.giver_id, 80);
  const receiverId = textField(body.receiver_id, 80);
  const action = body.action;
  if (!giverId || !receiverId || giverId === receiverId || !['add', 'remove'].includes(String(action))) {
    return jsonError('Выберите двух разных участников и действие.');
  }

  try {
    const db = getSupabaseAdmin();
    const auth = await getOrganizerGame(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    if (auth.game.status !== 'registration') return jsonError('После жеребьёвки ограничения менять нельзя.', 409);

    const { data: roster, error: rosterError } = await db.from('participants').select('id').eq('game_id', auth.game.id).in('id', [giverId, receiverId]);
    if (rosterError) return jsonError('Не удалось проверить участников.', 500);
    if (!roster || roster.length !== 2) return jsonError('Один из участников не относится к этой игре.', 400);

    if (action === 'add') {
      const { error } = await db.from('restrictions').upsert({ game_id: auth.game.id, giver_id: giverId, receiver_id: receiverId }, { onConflict: 'game_id,giver_id,receiver_id', ignoreDuplicates: true });
      if (error) return jsonError('Не удалось добавить ограничение.', 500);
    } else {
      const { error } = await db.from('restrictions').delete().eq('game_id', auth.game.id).eq('giver_id', giverId).eq('receiver_id', receiverId);
      if (error) return jsonError('Не удалось удалить ограничение.', 500);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('save restriction error', error);
    return jsonError('Сервер не настроен: подключите Supabase.', 500);
  }
}

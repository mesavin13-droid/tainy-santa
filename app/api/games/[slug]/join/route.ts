import { NextResponse } from 'next/server';
import { createAccessToken, hashAccessToken } from '@/lib/tokens';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError, readJsonObject, textField, todayUtc } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Проверьте форму участника.'); }
  if (!body) return jsonError('Проверьте форму участника.');

  const displayName = textField(body.display_name, 80);
  const department = textField(body.department ?? '', 80, true);
  const wishlist = textField(body.wishlist ?? '', 1000, true);
  if (!displayName || department === null || wishlist === null) return jsonError('Заполните имя. Отдел и пожелания могут быть пустыми.');

  try {
    const db = getSupabaseAdmin();
    const { data: game, error: gameError } = await db.from('games')
      .select('id, status, registration_deadline').eq('slug', slug).maybeSingle();
    if (gameError) return jsonError('Не удалось проверить игру.', 500);
    if (!game) return jsonError('Игра не найдена.', 404);
    if (game.status !== 'registration') return jsonError('Регистрация на эту игру закрыта.', 409);
    if (game.registration_deadline && game.registration_deadline < todayUtc()) return jsonError('Срок регистрации уже закончился.', 409);

    const participantToken = createAccessToken();
    const { data: participant, error } = await db.from('participants').insert({
      game_id: game.id,
      display_name: displayName,
      department,
      wishlist,
      access_token_hash: hashAccessToken(participantToken),
    }).select('id, display_name, department, wishlist, gift_state, created_at').single();

    if (error || !participant) {
      console.error('join game failed', error?.message);
      if (error?.message.includes('registration_closed') || error?.message.includes('registration_deadline_passed')) return jsonError('Регистрация уже закрыта.', 409);
      return jsonError('Не удалось добавить участника. Попробуйте ещё раз.', 500);
    }

    return NextResponse.json({ participant, participantToken }, { status: 201 });
  } catch (error) {
    console.error('join game error', error);
    return jsonError('Сервер не настроен: подключите Supabase.', 500);
  }
}

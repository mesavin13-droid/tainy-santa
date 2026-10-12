import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/http';
import { makeSecretSantaMatching, type ForbiddenPair } from '@/lib/matching';
import { getOrganizerGame } from '@/lib/participant-context';
import { hashAccessToken, readBearerToken } from '@/lib/tokens';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const token = request.headers.get('x-organizer-token') ?? readBearerToken(request.headers.get('authorization'));
  if (!token) return jsonError('Нужна личная ссылка организатора.', 401);

  try {
    const db = getSupabaseAdmin();
    const auth = await getOrganizerGame(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    const game = auth.game;
    if (game.status !== 'registration') return jsonError('Жеребьёвка уже проведена или регистрация закрыта.', 409);

    const [{ data: participants, error: pError }, { data: restrictions, error: rError }] = await Promise.all([
      db.from('participants').select('id').eq('game_id', game.id),
      db.from('restrictions').select('giver_id, receiver_id').eq('game_id', game.id),
    ]);
    if (pError || rError) return jsonError('Не удалось проверить участников и ограничения.', 500);
    if (!participants || participants.length < 2) return jsonError('Для жеребьёвки нужно минимум два участника.', 409);

    const participantRows = participants as Array<{ id: string }>;
    const participantIds = participantRows.map((p: { id: string }) => p.id);
    const pairs = makeSecretSantaMatching(participantIds, (restrictions ?? []) as ForbiddenPair[]);
    if (!pairs) {
      return jsonError('С текущими ограничениями жеребьёвка невозможна. Измените ограничения и попробуйте снова. Ничего не распределено.', 422);
    }

    const { data, error } = await db.rpc('finalize_secret_santa_draw', {
      p_game_id: game.id,
      p_organizer_token_hash: hashAccessToken(token),
      p_expected_participant_ids: participantIds,
      p_pairs: pairs,
    });
    if (error) {
      console.error('finalize draw failed', error.message);
      const message = error.message.includes('roster_changed')
        ? 'Список участников изменился во время жеребьёвки. Обновите страницу и попробуйте ещё раз.'
        : error.message.includes('not_authorized')
          ? 'Недействительная ссылка организатора.'
          : error.message.includes('draw_already_done')
            ? 'Жеребьёвка уже проведена.'
            : 'Не удалось зафиксировать жеребьёвку. Повторите попытку.';
      return jsonError(message, 409);
    }
    return NextResponse.json({ result: data });
  } catch (error) {
    console.error('draw error', error);
    return jsonError('Сервер не настроен: подключите Supabase и примените миграции.', 500);
  }
}

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isIsoDate, jsonError, readJsonObject, textField, todayUtc } from '@/lib/http';
import { getOrganizerGame } from '@/lib/participant-context';
import { hashAccessToken, readBearerToken } from '@/lib/tokens';

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

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const token = request.headers.get('x-organizer-token') ?? readBearerToken(request.headers.get('authorization'));
  if (!token) return jsonError('Нужна личная ссылка организатора.', 401);
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Проверьте настройки игры.'); }
  if (!body) return jsonError('Проверьте настройки игры.');

  const name = textField(body.name, 100);
  const companyName = textField(body.company_name, 100);
  const rules = textField(body.rules ?? '', 1500, true);
  const budget = Number(body.budget);
  const exchangeDate = body.exchange_date;
  const registrationDeadline = body.registration_deadline;
  if (!name || !companyName || rules === null) return jsonError('Проверьте название и правила игры.');
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > 10_000_000) return jsonError('Укажите бюджет от 1 до 10 000 000 ₽.');
  if (!isIsoDate(exchangeDate) || !isIsoDate(registrationDeadline)) return jsonError('Введите корректные даты.');
  if (registrationDeadline < todayUtc() || registrationDeadline > exchangeDate) return jsonError('Регистрация должна завершиться не раньше сегодня и не позже обмена подарками.');

  try {
    const db = getSupabaseAdmin();
    const auth = await getOrganizerGame(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    if (auth.game.status !== 'registration') return jsonError('После жеребьёвки настройки менять нельзя.', 409);
    const { data: game, error } = await db.from('games')
      .update({ name, company_name: companyName, budget, exchange_date: exchangeDate, registration_deadline: registrationDeadline, rules })
      .eq('id', auth.game.id).eq('status', 'registration')
      .select('id, slug, name, company_name, budget, exchange_date, registration_deadline, rules, status').maybeSingle();
    if (error) return jsonError('Не удалось сохранить настройки игры.', 500);
    if (!game) return jsonError('Жеребьёвка уже проведена. Настройки не изменены.', 409);
    return NextResponse.json({ game });
  } catch (error) {
    console.error('update santa game error', error);
    return jsonError('Сервер не настроен: подключите Supabase.', 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const token = request.headers.get('x-organizer-token') ?? readBearerToken(request.headers.get('authorization'));
  if (!token) return jsonError('Нужна личная ссылка организатора.', 401);
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Проверьте участника.'); }
  const participantId = body ? textField(body.participant_id, 80) : null;
  if (!participantId || !/^[0-9a-fA-F-]{36}$/.test(participantId)) return jsonError('Укажите участника для удаления.');

  try {
    const db = getSupabaseAdmin();
    const auth = await getOrganizerGame(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    if (auth.game.status !== 'registration') return jsonError('После жеребьёвки участников удалить нельзя.', 409);

    // The SQL function locks the game row before removing a participant,
    // so deletion cannot race with the atomic draw.
    const { data, error } = await db.rpc('remove_santa_participant', {
      p_game_id: auth.game.id,
      p_organizer_token_hash: hashAccessToken(token),
      p_participant_id: participantId,
    });
    if (error) {
      console.error('remove santa participant failed', error.message);
      if (error.message.includes('participants_locked')) return jsonError('Жеребьёвка уже проведена.', 409);
      if (error.message.includes('not_authorized')) return jsonError('Ссылка организатора недействительна.', 401);
      return jsonError('Не удалось удалить участника. Проверьте применение миграции 0006.', 500);
    }
    if (!data) return jsonError('Участник не найден.', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('remove santa participant error', error);
    return jsonError('Сервер не настроен: подключите Supabase.', 500);
  }
}

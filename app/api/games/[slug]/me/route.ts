import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError, readJsonObject, textField } from '@/lib/http';
import { getParticipantContext } from '@/lib/participant-context';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Не удалось проверить личную ссылку.'); }
  const token = body ? textField(body.token, 200) : null;
  if (!token) return jsonError('Нужна личная ссылка участника.', 401);

  try {
    const db = getSupabaseAdmin();
    const auth = await getParticipantContext(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    const { game, participant } = auth;

    const [{ data: assignment, error: assignmentError }, { data: inboxRows, error: inboxError }, { data: outboxRows, error: outboxError }, { data: incomingAssignments, error: incomingAssignmentsError }] = await Promise.all([
      db.from('assignments').select('receiver_id').eq('game_id', game.id).eq('giver_id', participant.id).maybeSingle(),
      db.from('messages').select('id, body, created_at, reply_to_id').eq('game_id', game.id).eq('receiver_id', participant.id).is('reply_to_id', null).order('created_at', { ascending: true }),
      db.from('messages').select('id, body, created_at').eq('game_id', game.id).eq('sender_id', participant.id).is('reply_to_id', null).order('created_at', { ascending: true }),
      db.from('assignments').select('giver_id').eq('game_id', game.id).eq('receiver_id', participant.id),
    ]);
    if (assignmentError || inboxError || outboxError || incomingAssignmentsError) return jsonError('Не удалось загрузить личный кабинет.', 500);

    let recipient: { display_name: string; department: string; wishlist: string } | null = null;
    if (['drawn', 'completed'].includes(game.status) && assignment?.receiver_id) {
      const { data } = await db.from('participants').select('display_name, department, wishlist').eq('game_id', game.id).eq('id', assignment.receiver_id).maybeSingle();
      recipient = data;
    }

    const outboxIds = ((outboxRows ?? []) as Array<{ id: string }>).map((m: { id: string }) => m.id);
    let replies: Array<{ id: string; body: string; reply_to_id: string; created_at: string }> = [];
    if (outboxIds.length) {
      const { data, error } = await db.from('messages').select('id, body, reply_to_id, created_at').eq('game_id', game.id).eq('receiver_id', participant.id).in('reply_to_id', outboxIds).order('created_at', { ascending: true });
      if (error) return jsonError('Не удалось загрузить ответы.', 500);
      replies = data ?? [];
    }

    const incomingIds = ((incomingAssignments ?? []) as Array<{ giver_id: string }>).map((item: { giver_id: string }) => item.giver_id);
    let revealedSenders: string[] = [];
    if (incomingIds.length) {
      const { data, error } = await db.from('participants').select('display_name').eq('game_id', game.id).in('id', incomingIds).not('revealed_at', 'is', null);
      if (error) return jsonError('Не удалось проверить раскрытия.', 500);
      revealedSenders = ((data ?? []) as Array<{ display_name: string }>).map((item: { display_name: string }) => item.display_name);
    }

    return NextResponse.json({
      game: { slug: game.slug, name: game.name, company_name: game.company_name, budget: game.budget, exchange_date: game.exchange_date, registration_deadline: game.registration_deadline, rules: game.rules, status: game.status },
      participant: { id: participant.id, display_name: participant.display_name, department: participant.department, wishlist: participant.wishlist, gift_state: participant.gift_state, revealed_at: participant.revealed_at },
      recipient,
      inbox: ((inboxRows ?? []) as Array<{ id: string; body: string; created_at: string }>).map((item: { id: string; body: string; created_at: string }) => ({ id: item.id, body: item.body, created_at: item.created_at })),
      outbox: ((outboxRows ?? []) as Array<{ id: string; body: string; created_at: string }>).map((item: { id: string; body: string; created_at: string }) => ({ id: item.id, body: item.body, created_at: item.created_at, answer: replies.find((reply: { reply_to_id: string; body: string }) => reply.reply_to_id === item.id)?.body ?? null })),
      revealedSenders,
    });
  } catch (error) {
    console.error('load participant cabinet error', error);
    return jsonError('Сервер не настроен: подключите Supabase и примените миграции.', 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Проверьте изменённые данные.'); }
  if (!body) return jsonError('Проверьте изменённые данные.');
  const token = textField(body.token, 200);
  if (!token) return jsonError('Нужна личная ссылка участника.', 401);

  try {
    const db = getSupabaseAdmin();
    const auth = await getParticipantContext(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    const patch: Record<string, unknown> = {};
    if ('wishlist' in body) {
      const wishlist = textField(body.wishlist, 1000, true);
      if (wishlist === null) return jsonError('Пожелания должны быть не длиннее 1000 символов.');
      patch.wishlist = wishlist;
    }
    if ('gift_state' in body) {
      if (!['pending', 'prepared', 'delivered'].includes(String(body.gift_state))) return jsonError('Неизвестный статус подарка.');
      patch.gift_state = body.gift_state;
    }
    if (body.reveal === true) {
      if (auth.game.status !== 'drawn' && auth.game.status !== 'completed') return jsonError('Сначала должна состояться жеребьёвка.', 409);
      patch.revealed_at = auth.participant.revealed_at ?? new Date().toISOString();
    }
    if (!Object.keys(patch).length) return jsonError('Нет данных для сохранения.');
    const { error } = await db.from('participants').update(patch).eq('game_id', auth.game.id).eq('id', auth.participant.id);
    if (error) return jsonError('Не удалось сохранить изменения.', 500);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('update participant error', error);
    return jsonError('Сервер не настроен: подключите Supabase.', 500);
  }
}

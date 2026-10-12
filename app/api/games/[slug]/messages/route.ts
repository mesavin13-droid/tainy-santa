import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError, readJsonObject, textField } from '@/lib/http';
import { getParticipantContext } from '@/lib/participant-context';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Проверьте сообщение.'); }
  const token = body ? textField(body.token, 200) : null;
  const message = body ? textField(body.body, 1000) : null;
  const replyToId = body && body.reply_to_id ? textField(body.reply_to_id, 80) : null;
  if (!body || !token || !message) return jsonError('Сообщение не должно быть пустым и не может превышать 1000 символов.');

  try {
    const db = getSupabaseAdmin();
    const auth = await getParticipantContext(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    if (auth.game.status !== 'drawn' && auth.game.status !== 'completed') return jsonError('Анонимные сообщения появятся после жеребьёвки.', 409);
    let receiverId: string | null = null;

    if (replyToId) {
      const { data: root, error: rootError } = await db.from('messages')
        .select('id, sender_id, receiver_id, reply_to_id').eq('game_id', auth.game.id).eq('id', replyToId).maybeSingle();
      if (rootError) return jsonError('Не удалось проверить вопрос.', 500);
      if (!root || root.reply_to_id !== null || root.receiver_id !== auth.participant.id || root.sender_id === auth.participant.id) {
        return jsonError('На это сообщение нельзя ответить.', 403);
      }
      receiverId = root.sender_id;
    } else {
      const { data: assignment, error: assignmentError } = await db.from('assignments').select('receiver_id')
        .eq('game_id', auth.game.id).eq('giver_id', auth.participant.id).maybeSingle();
      if (assignmentError) return jsonError('Не удалось определить получателя сообщения.', 500);
      receiverId = assignment?.receiver_id ?? null;
      if (!receiverId) return jsonError('У вас пока нет получателя подарка.', 409);
    }

    const { data: created, error } = await db.from('messages').insert({
      game_id: auth.game.id,
      sender_id: auth.participant.id,
      receiver_id: receiverId,
      body: message,
      reply_to_id: replyToId,
    }).select('id, body, created_at').single();
    if (error || !created) return jsonError('Не удалось отправить сообщение.', 500);
    return NextResponse.json({ message: created }, { status: 201 });
  } catch (error) {
    console.error('send message error', error);
    return jsonError('Сервер не настроен: примените миграции Supabase.', 500);
  }
}

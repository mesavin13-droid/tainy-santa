import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError, readJsonObject, textField } from '@/lib/http';
import { getParticipantContext } from '@/lib/participant-context';

export const runtime = 'nodejs';
const BUCKET = 'santa-video-greetings';
const MAX_BYTES = 50 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Не удалось обработать видео.'); }
  const token = body ? textField(body.token, 200) : null;
  const action = body ? textField(body.action, 20) : null;
  if (!body || !token || !['prepare', 'complete'].includes(action ?? '')) return jsonError('Проверьте данные видео.');

  try {
    const db = getSupabaseAdmin();
    const auth = await getParticipantContext(db, slug, token);
    if ('error' in auth) return jsonError(auth.error, auth.status);
    if (!['drawn', 'completed'].includes(auth.game.status)) return jsonError('Видео-поздравление можно отправить после жеребьёвки.', 409);

    const { data: assignment, error: assignmentError } = await db.from('assignments')
      .select('receiver_id').eq('game_id', auth.game.id).eq('giver_id', auth.participant.id).maybeSingle();
    if (assignmentError) return jsonError('Не удалось определить получателя.', 500);
    if (!assignment?.receiver_id) return jsonError('У вас пока нет получателя подарка.', 409);

    if (action === 'prepare') {
      const mimeType = textField(body.content_type, 50);
      const size = Number(body.size);
      const extension = mimeType ? MIME_EXT[mimeType] : undefined;
      if (!extension || !Number.isFinite(size) || size < 1 || size > MAX_BYTES) {
        return jsonError('Выберите видео MP4, WebM или MOV размером до 50 МБ.');
      }
      const { data: existing, error: existingError } = await db.from('video_greetings')
        .select('id, storage_path, uploaded_at').eq('game_id', auth.game.id).eq('giver_id', auth.participant.id).maybeSingle();
      if (existingError) return jsonError('Не удалось проверить видео-поздравление.', 500);
      if (existing?.uploaded_at) return jsonError('Видео-поздравление уже отправлено. Повторная отправка пока недоступна.', 409);
      if (existing && !existing.uploaded_at) {
        await db.storage.from(BUCKET).remove([existing.storage_path]);
        await db.from('video_greetings').delete().eq('id', existing.id);
      }

      const storagePath = `${auth.game.id}/${auth.participant.id}/${randomUUID()}.${extension}`;
      const { data: created, error: insertError } = await db.from('video_greetings').insert({
        game_id: auth.game.id, giver_id: auth.participant.id, receiver_id: assignment.receiver_id,
        storage_path: storagePath, mime_type: mimeType,
      }).select('id').single();
      if (insertError || !created) return jsonError('Не удалось подготовить отправку видео.', 500);

      const { data: signed, error: signedError } = await db.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (signedError || !signed) {
        await db.from('video_greetings').delete().eq('id', created.id);
        return jsonError('Не удалось подготовить безопасную загрузку видео.', 500);
      }
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return NextResponse.json({ greetingId: created.id, signedUrl: signed.signedUrl, token: signed.token, baseUrl, storagePath });
    }

    const greetingId = textField(body.greeting_id, 80);
    if (!greetingId) return jsonError('Не найдено видео-поздравление.');
    const { data: greeting, error: greetingError } = await db.from('video_greetings')
      .select('id, storage_path, uploaded_at').eq('id', greetingId).eq('game_id', auth.game.id)
      .eq('giver_id', auth.participant.id).maybeSingle();
    if (greetingError || !greeting) return jsonError('Видео-поздравление не найдено.', 404);
    const { error: checkError } = await db.storage.from(BUCKET).createSignedUrl(greeting.storage_path, 60);
    if (checkError) return jsonError('Видео ещё не загрузилось. Попробуйте ещё раз.', 409);
    const { error: updateError } = await db.from('video_greetings').update({ uploaded_at: new Date().toISOString() }).eq('id', greeting.id);
    if (updateError) return jsonError('Видео загружено, но не удалось завершить отправку.', 500);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('video greeting error', error);
    return jsonError('Сервер не настроен: проверьте подключение Supabase и миграции.', 500);
  }
}

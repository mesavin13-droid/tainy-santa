import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const db = getSupabaseAdmin();
    const { data: game, error } = await db.from('games')
      .select('id, slug, name, company_name, budget, exchange_date, registration_deadline, rules, status, created_at')
      .eq('slug', slug).maybeSingle();
    if (error) return jsonError('Не удалось загрузить игру.', 500);
    if (!game) return jsonError('Игра не найдена. Проверьте ссылку или код.', 404);

    const [{ count, error: countError }, { data: recentParticipants, error: namesError }] = await Promise.all([
      db.from('participants').select('id', { count: 'exact', head: true }).eq('game_id', game.id),
      db.from('participants').select('display_name, created_at').eq('game_id', game.id).order('created_at', { ascending: false }).limit(12),
    ]);
    if (countError || namesError) return jsonError('Не удалось загрузить список участников.', 500);
    return NextResponse.json({ game, participantCount: count ?? 0, recentParticipants: recentParticipants ?? [] });
  } catch (error) {
    console.error('load game error', error);
    return jsonError('Сервер не настроен: подключите Supabase.', 500);
  }
}

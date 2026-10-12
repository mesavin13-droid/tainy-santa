import { NextResponse } from 'next/server';
import { createAccessToken, hashAccessToken } from '@/lib/tokens';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isIsoDate, jsonError, readJsonObject, textField, todayUtc } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: Record<string, unknown> | null;
  try { body = readJsonObject(await request.json()); } catch { return jsonError('Проверьте данные формы.'); }
  if (!body) return jsonError('Проверьте данные формы.');

  const name = textField(body.name, 100);
  const companyName = textField(body.company_name, 100);
  const rules = textField(body.rules ?? '', 1500, true);
  const budget = Number(body.budget);
  const exchangeDate = body.exchange_date;
  const registrationDeadline = body.registration_deadline;

  if (!name || !companyName || rules === null) return jsonError('Название игры, компания или правила заполнены некорректно.');
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > 10_000_000) return jsonError('Бюджет должен быть положительным числом.');
  if (!isIsoDate(exchangeDate) || !isIsoDate(registrationDeadline)) return jsonError('Укажите корректные даты обмена и окончания регистрации.');
  if (registrationDeadline < todayUtc()) return jsonError('Срок регистрации не может быть в прошлом.');
  if (registrationDeadline > exchangeDate) return jsonError('Регистрация должна завершиться не позже дня обмена.');

  const organizerToken = createAccessToken();
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('games').insert({
      name,
      company_name: companyName,
      budget,
      exchange_date: exchangeDate,
      registration_deadline: registrationDeadline,
      rules,
      organizer_token_hash: hashAccessToken(organizerToken),
    }).select('id, slug, name, company_name, budget, exchange_date, registration_deadline, rules, status').single();

    if (error || !data) {
      console.error('create game failed', error?.message);
      return jsonError('Не удалось создать игру. Проверьте подключение базы данных.', 500);
    }

    return NextResponse.json({ game: data, organizerToken }, { status: 201 });
  } catch (error) {
    console.error('create game error', error);
    return jsonError(error instanceof Error ? error.message : 'Сервер не настроен.', 500);
  }
}

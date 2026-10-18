import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Video greetings have been retired. Keeping the route as 410 prevents
// old clients from creating uploads, without deleting existing user data.
export async function POST() {
  return NextResponse.json({ error: 'Видео-поздравления больше не поддерживаются.' }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ error: 'Видео-поздравления больше не поддерживаются.' }, { status: 410 });
}

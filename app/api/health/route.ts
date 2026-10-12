import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Safe deployment diagnostic. Never returns environment values or raw database
 * errors; use it to distinguish missing configuration from a reachable schema.
 */
export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, status: 'configuration_missing' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from('games').select('id', { head: true, count: 'exact' });
    if (error) {
      console.error('health check database query failed', error.code ?? 'unknown');
      return NextResponse.json(
        { ok: false, status: 'database_unavailable' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }
    return NextResponse.json(
      { ok: true, status: 'ready' },
      { status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, status: 'database_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }
}

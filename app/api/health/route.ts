import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lightweight deploy / load-balancer probe.
 * Does not touch the database so recreates stay green while Postgres reconnects briefly.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'visa',
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

import { NextResponse } from 'next/server';
import { revalidatePublicVisaCatalog } from '@/lib/revalidate-public-catalog';

/**
 * Local/dev helper to bust public visa listing cache after direct DB edits.
 * Safe to keep: no-op outside development unless REVALIDATE_SECRET matches.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    const header = request.headers.get('x-revalidate-secret')?.trim();
    if (!secret || header !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    countryCode?: string;
    listingId?: string;
    listingSlug?: string;
  };

  await revalidatePublicVisaCatalog({
    countryCode: body.countryCode,
    listingId: body.listingId,
    listingSlug: body.listingSlug,
    warm: false,
  });

  return NextResponse.json({ ok: true });
}

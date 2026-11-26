import { NextResponse } from 'next/server';
import { buildLlmsTxt } from '@/lib/seo/llmsTxt';

/** Refresh when admin catalog changes call revalidatePath('/llms.txt'). */
export const revalidate = 3600;

/**
 * Machine-readable preferred sources for AI / answer engines (AEO/GEO).
 * Spec-inspired plain text at https://www.viserv.in/llms.txt
 */
export async function GET() {
  const body = await buildLlmsTxt();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { readStoredObject } from '@/lib/upload/readStoredObject';
import {
  VISA_OUTCOME_SLOT,
  isSendableVisaOutcomeMime,
  normalizeVisaOutcomeMime,
  waMediaPathExtension,
} from '@/lib/visa/outcomeDocumentShared';
import { verifyWaMediaToken } from '@/lib/wa-media/token';

export const runtime = 'nodejs';

/**
 * Fixed tokens for Meta/Twilio template sample approval.
 * Twilio requires the sample path to end with a file extension.
 */
const DEMO_MEDIA_TOKENS = new Set([
  'demo',
  'demo.pdf',
  'sample',
  'sample.pdf',
  'demo.jpg',
  'sample.jpg',
]);

function normalizeMediaToken(raw: string): string {
  return decodeMediaToken(raw);
}

/** Tokens may be submitted as `…/token.pdf` (or image ext) so Twilio sees a suffix. */
function tokenWithoutMediaSuffix(token: string): string {
  return token.replace(/\.(pdf|jpe?g|png|webp)$/i, '');
}

/**
 * Next may give the raw segment; decode once. Keep `~` (token separator) unencoded.
 */
function decodeMediaToken(raw: string): string {
  try {
    return decodeURIComponent(raw || '').trim();
  } catch {
    return (raw || '').trim();
  }
}

async function serveDemoPdf(): Promise<NextResponse> {
  const filePath = path.join(process.cwd(), 'public', 'wa-media-sample.pdf');
  const buffer = await readFile(filePath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.byteLength),
      'Content-Disposition':
        'attachment; filename="wa-media-sample.pdf"; filename*=UTF-8\'\'wa-media-sample.pdf',
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Public short-TTL media fetch for Twilio WhatsApp document/image templates.
 * Token is signed; only visa_outcome PDF/image files are served.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await context.params;
    const token = normalizeMediaToken(rawToken);
    if (!token) {
      return new NextResponse('Not found', { status: 404 });
    }

    if (DEMO_MEDIA_TOKENS.has(token.toLowerCase())) {
      return serveDemoPdf();
    }

    const signedToken = tokenWithoutMediaSuffix(token);
    const verified = verifyWaMediaToken(signedToken);
    if (!verified) {
      return new NextResponse('Not found', { status: 404 });
    }

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, verified.documentId))
      .limit(1);

    if (!doc || doc.documentType !== VISA_OUTCOME_SLOT) {
      return new NextResponse('Not found', { status: 404 });
    }
    if (!doc.s3Key.startsWith('applications/')) {
      return new NextResponse('Not found', { status: 404 });
    }

    const mime = normalizeVisaOutcomeMime(doc.mimeType, doc.filename);
    if (!isSendableVisaOutcomeMime(mime)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const stored = await readStoredObject(doc.s3Key);
    if (!stored) {
      return new NextResponse('Not found', { status: 404 });
    }

    const ext = waMediaPathExtension(mime);
    const filename = doc.filename?.includes('.')
      ? doc.filename
      : `${doc.filename || 'visa-document'}.${ext}`;
    const safeName = filename.replace(/"/g, '');
    const body = new Uint8Array(stored.buffer);
    const disposition =
      mime === 'application/pdf' ? 'attachment' : 'inline';

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        'Cache-Control': 'private, no-store',
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[wa-media] Failed to serve document', error);
    return new NextResponse('Not found', { status: 404 });
  }
}

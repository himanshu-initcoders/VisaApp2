import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { readStoredObject } from '@/lib/upload/readStoredObject';
import { VISA_OUTCOME_SLOT } from '@/lib/visa/outcomeDocumentShared';
import { verifyWaMediaToken } from '@/lib/wa-media/token';

export const runtime = 'nodejs';

/**
 * Fixed tokens for Meta/Twilio template sample approval.
 * Twilio requires the sample path to end with a file extension (e.g. .pdf).
 */
const DEMO_MEDIA_TOKENS = new Set(['demo', 'demo.pdf', 'sample', 'sample.pdf']);

function normalizeMediaToken(raw: string): string {
  return decodeURIComponent(raw || '').trim();
}

/** Tokens may be submitted as `…/token.pdf` so Twilio sees a PDF suffix. */
function tokenWithoutPdfSuffix(token: string): string {
  return token.toLowerCase().endsWith('.pdf')
    ? token.slice(0, -4)
    : token;
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
 * Public short-TTL media fetch for Twilio WhatsApp document templates.
 * Token is signed; only visa_outcome PDFs are served.
 * Special tokens `demo` / `demo.pdf` serve public/wa-media-sample.pdf for template approval.
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

    const signedToken = tokenWithoutPdfSuffix(token);
    const verified = verifyWaMediaToken(signedToken);
    if (!verified) {
      return new NextResponse('Not found', { status: 404 });
    }

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, verified.documentId))
      .limit(1);

    if (
      !doc ||
      doc.applicationType !== 'visa' ||
      doc.documentType !== VISA_OUTCOME_SLOT
    ) {
      return new NextResponse('Not found', { status: 404 });
    }

    const mime = (doc.mimeType || '').toLowerCase();
    if (mime !== 'application/pdf') {
      return new NextResponse('Not found', { status: 404 });
    }

    const stored = await readStoredObject(doc.s3Key);
    if (!stored) {
      return new NextResponse('Not found', { status: 404 });
    }

    const filename = doc.filename?.endsWith('.pdf')
      ? doc.filename
      : `${doc.filename || 'visa-document'}.pdf`;
    const safeName = filename.replace(/"/g, '');
    const body = new Uint8Array(stored.buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
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

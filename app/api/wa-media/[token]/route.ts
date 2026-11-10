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

/** Fixed path for Meta/Twilio template sample approval only. */
const DEMO_MEDIA_TOKENS = new Set(['demo', 'sample']);

async function serveDemoPdf(): Promise<NextResponse> {
  const filePath = path.join(process.cwd(), 'public', 'wa-media-sample.pdf');
  const buffer = await readFile(filePath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="wa-media-sample.pdf"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * Public short-TTL media fetch for Twilio WhatsApp document templates.
 * Token is signed; only visa_outcome PDFs are served.
 * Special tokens `demo` / `sample` serve public/wa-media-sample.pdf for template approval.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await context.params;
    const token = decodeURIComponent(rawToken || '').trim();
    if (!token) {
      return new NextResponse('Not found', { status: 404 });
    }

    if (DEMO_MEDIA_TOKENS.has(token.toLowerCase())) {
      return serveDemoPdf();
    }

    const verified = verifyWaMediaToken(token);
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

    return new NextResponse(new Uint8Array(stored.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[wa-media] Failed to serve document', error);
    return new NextResponse('Not found', { status: 404 });
  }
}

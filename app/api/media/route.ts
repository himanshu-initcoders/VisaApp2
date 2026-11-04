/**
 * Authenticated/public media proxy for private object storage (S3).
 * Marketing prefixes are public; applications/* requires a signed-in session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import {
  assertSafeMediaKey,
  isApplicationMediaKey,
  isPublicMediaKey,
} from '@/lib/upload/mediaUrl';
import { UPLOADS_ROOT } from '@/lib/upload/safeStorageKey';

export const runtime = 'nodejs';

function guessMime(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function getS3Client(): { client: S3Client; bucket: string } | null {
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    client: new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

async function readLocal(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(UPLOADS_ROOT, key));
  } catch {
    return null;
  }
}

async function readS3(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const s3 = getS3Client();
  if (!s3) return null;
  try {
    const result = await s3.client.send(
      new GetObjectCommand({ Bucket: s3.bucket, Key: key })
    );
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: result.ContentType || guessMime(key),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const rawKey = request.nextUrl.searchParams.get('key') || '';
    let key: string;
    try {
      key = assertSafeMediaKey(rawKey);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid key' },
        { status: 400 }
      );
    }

    if (isApplicationMediaKey(key) && !isPublicMediaKey(key)) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const provider = (process.env.UPLOAD_PROVIDER || 'local').toLowerCase();

    let buffer: Buffer | null = null;
    let contentType = guessMime(key);

    if (provider === 's3') {
      const fromS3 = await readS3(key);
      if (fromS3) {
        buffer = fromS3.buffer;
        contentType = fromS3.contentType;
      }
    }

    if (!buffer) {
      buffer = await readLocal(key);
    }

    // Fallback: if provider is local but object only exists on S3 (post-migration)
    if (!buffer && provider !== 's3') {
      const fromS3 = await readS3(key);
      if (fromS3) {
        buffer = fromS3.buffer;
        contentType = fromS3.contentType;
      }
    }

    if (!buffer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const cacheControl = isPublicMediaKey(key)
      ? 'public, max-age=86400, stale-while-revalidate=604800'
      : 'private, no-store';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('media GET error:', error);
    return NextResponse.json({ error: 'Failed to load media' }, { status: 500 });
  }
}

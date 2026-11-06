/**
 * Read an application object with provider credentials.
 * Do not fetch /api/media from the server: application keys require a browser session,
 * so a server-side fetch returns 401 even when the object exists.
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';
import { uploadService } from '@/lib/upload';
import { UPLOADS_ROOT, assertSafeStorageKey } from '@/lib/upload/safeStorageKey';

export interface StoredObjectBytes {
  buffer: Buffer;
  mimeType: string;
}

function guessMime(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function s3Client(): { client: S3Client; bucket: string } | null {
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

async function readLocal(key: string): Promise<StoredObjectBytes | null> {
  try {
    const buffer = await fs.readFile(path.join(UPLOADS_ROOT, key));
    return { buffer, mimeType: guessMime(key) };
  } catch {
    return null;
  }
}

async function readS3(key: string): Promise<StoredObjectBytes | null> {
  const s3 = s3Client();
  if (!s3) return null;
  try {
    const result = await s3.client.send(
      new GetObjectCommand({ Bucket: s3.bucket, Key: key })
    );
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    const stored = result.ContentType?.split(';')[0]?.trim();
    return {
      buffer: Buffer.from(bytes),
      mimeType:
        stored && stored !== 'application/octet-stream' ? stored : guessMime(key),
    };
  } catch (error) {
    console.error('[Upload] S3 read failed:', key, error);
    return null;
  }
}

export async function readStoredObject(
  storageKey: string
): Promise<StoredObjectBytes | null> {
  const key = assertSafeStorageKey(storageKey);
  const provider = uploadService.getProviderName();

  if (provider === 'local') return readLocal(key);
  if (provider === 's3') return readS3(key);

  const url = uploadService.getUrl(key);
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const stored = response.headers.get('content-type')?.split(';')[0]?.trim();
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType:
      stored && stored !== 'application/octet-stream' ? stored : guessMime(key),
  };
}

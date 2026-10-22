/**
 * Multipart draft file upload / restore / delete (no Base64).
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { canAccessAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { uploadService } from '@/lib/upload';
import {
  APPLICATION_UPLOAD_FOLDER,
  buildDraftObjectKey,
  extensionFromMime,
  isDraftObjectKey,
} from '@/lib/upload/applicationKey';
import {
  UPLOADS_ROOT,
  assertSafeStorageKey,
} from '@/lib/upload/safeStorageKey';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

async function resolveOwnerUserId(
  actorId: string,
  role: string | undefined,
  ownerUserId: string | null
): Promise<{ ok: true; ownerUserId: string } | { ok: false; error: string }> {
  if (!ownerUserId || ownerUserId === actorId) {
    return { ok: true, ownerUserId: actorId };
  }
  if (!canAccessAdmin({ role })) {
    return { ok: false, error: 'Not allowed' };
  }
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, ownerUserId))
    .limit(1);
  if (!target) return { ok: false, error: 'Applicant not found' };
  return { ok: true, ownerUserId: target.id };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const actorId = await resolveSessionUserId(session.user);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const listingId = String(form.get('listingId') || '').trim();
    const countryCode = String(form.get('countryCode') || '').trim();
    const passengerId = String(form.get('passengerId') || '').trim();
    const slotKey = String(form.get('slotKey') || '').trim();
    const ownerUserIdRaw = form.get('ownerUserId');
    const ownerUserId =
      typeof ownerUserIdRaw === 'string' ? ownerUserIdRaw.trim() : null;
    const file = form.get('file');

    if (!listingId || !countryCode || !passengerId || !slotKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File required' }, { status: 400 });
    }

    const owner = await resolveOwnerUserId(
      actorId,
      session.user.role,
      ownerUserId
    );
    if (!owner.ok) {
      return NextResponse.json({ error: owner.error }, { status: 403 });
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.includes(mimeType as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extensionFromMime(mimeType, file.name);
    const explicitKey = buildDraftObjectKey({
      countryCode,
      listingId,
      userId: owner.ownerUserId,
      passengerId,
      slotKey,
      ext,
    });

    const result = await uploadService.upload(buffer, {
      folder: APPLICATION_UPLOAD_FOLDER,
      filename: file.name || `${slotKey}.${ext}`,
      explicitKey,
      maxSizeMB: mimeType === 'application/pdf' ? 10 : 5,
      allowedTypes: [...ALLOWED_TYPES],
      metadata: {
        passengerId,
        slotKey,
        listingId,
        draft: '1',
        ownerUserId: owner.ownerUserId,
      },
    });

    return NextResponse.json({
      success: true,
      result: {
        passengerId,
        slotKey,
        key: result.key,
        url: result.url,
        mimeType: result.mimeType || mimeType,
        filename: result.filename || file.name,
        size: result.size,
      },
    });
  } catch (error) {
    console.error('draft-files POST error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const actorId = await resolveSessionUserId(session.user);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storageKeyRaw = searchParams.get('storageKey') || '';
    const ownerUserId = searchParams.get('ownerUserId');

    let storageKey: string;
    try {
      storageKey = assertSafeStorageKey(storageKeyRaw);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Invalid key',
        },
        { status: 400 }
      );
    }

    const owner = await resolveOwnerUserId(
      actorId,
      session.user.role,
      ownerUserId
    );
    if (!owner.ok) {
      return NextResponse.json({ error: owner.error }, { status: 403 });
    }
    if (!isDraftObjectKey(storageKey, owner.ownerUserId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let buffer: Buffer | null = null;
    let mimeType = 'application/octet-stream';
    const filename = storageKey.split('/').pop() || 'document.bin';

    if (uploadService.getProviderName() === 'local') {
      try {
        buffer = await fs.readFile(path.join(UPLOADS_ROOT, storageKey));
      } catch {
        buffer = null;
      }
    }

    if (!buffer) {
      const url = uploadService.getUrl(storageKey);
      const absolute =
        url.startsWith('http') || url.startsWith('//')
          ? url
          : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${url.startsWith('/') ? '' : '/'}${url}`;
      const response = await fetch(absolute);
      if (!response.ok) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      buffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get('content-type') || mimeType;
    }

    if (filename.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (filename.endsWith('.png')) mimeType = 'image/png';
    else if (filename.endsWith('.webp')) mimeType = 'image/webp';
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('draft-files GET error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const actorId = await resolveSessionUserId(session.user);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      storageKey?: string;
      ownerUserId?: string;
    } | null;

    let storageKey: string;
    try {
      storageKey = assertSafeStorageKey(body?.storageKey || '');
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Invalid key',
        },
        { status: 400 }
      );
    }

    const owner = await resolveOwnerUserId(
      actorId,
      session.user.role,
      body?.ownerUserId ?? null
    );
    if (!owner.ok) {
      return NextResponse.json({ error: owner.error }, { status: 403 });
    }
    if (!isDraftObjectKey(storageKey, owner.ownerUserId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await uploadService.delete({ key: storageKey });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('draft-files DELETE error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}

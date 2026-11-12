/**
 * Multipart draft file upload / restore / delete (no Base64).
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { readStoredObject } from '@/lib/upload/readStoredObject';
import { assertSafeStorageKey } from '@/lib/upload/safeStorageKey';
import { deleteOtherSlotExtensionKeys } from '@/lib/upload/deleteSlotSiblings';

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
    // Sniff bytes so a PDF is never stored under a leftover `.jpg` slot key.
    let effectiveMime = mimeType;
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      effectiveMime = 'application/pdf';
    }
    const ext = extensionFromMime(effectiveMime, file.name);
    const explicitKey = buildDraftObjectKey({
      countryCode,
      listingId,
      userId: owner.ownerUserId,
      passengerId,
      slotKey,
      ext,
    });

    const previousStorageKeyRaw = form.get('previousStorageKey');
    const previousStorageKey =
      typeof previousStorageKeyRaw === 'string'
        ? previousStorageKeyRaw.trim()
        : '';

    const uploadFilename = (() => {
      const original = (file.name || '').trim();
      if (original) {
        return original.replace(/\.[^.]+$/i, '') + `.${ext}`;
      }
      return `${slotKey}.${ext}`;
    })();

    const result = await uploadService.upload(buffer, {
      folder: APPLICATION_UPLOAD_FOLDER,
      filename: uploadFilename,
      mimeType: effectiveMime,
      explicitKey,
      maxSizeMB: effectiveMime === 'application/pdf' ? 10 : 5,
      allowedTypes: [...ALLOWED_TYPES],
      metadata: {
        passengerId,
        slotKey,
        listingId,
        draft: '1',
        ownerUserId: owner.ownerUserId,
      },
    });

    // Drop prior key when extension/MIME changed; also purge sibling extensions on S3/local.
    if (
      previousStorageKey &&
      previousStorageKey !== result.key &&
      isDraftObjectKey(previousStorageKey, owner.ownerUserId)
    ) {
      try {
        await uploadService.delete({
          key: assertSafeStorageKey(previousStorageKey),
        });
      } catch (error) {
        console.warn(
          '[Draft] Failed to delete previous draft key:',
          previousStorageKey,
          error
        );
      }
    }
    await deleteOtherSlotExtensionKeys(result.key);

    return NextResponse.json({
      success: true,
      result: {
        passengerId,
        slotKey,
        key: result.key,
        url: result.url,
        mimeType: result.mimeType || effectiveMime,
        filename: result.filename || uploadFilename,
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

    const filename = storageKey.split('/').pop() || 'document.bin';
    const stored = await readStoredObject(storageKey);
    if (!stored) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const buffer = stored.buffer;
    // Prefer magic bytes — a PDF saved under a leftover `.jpg` slot key must
    // not be served as image/jpeg (that produces broken <img> previews).
    let mimeType = stored.mimeType || 'application/octet-stream';
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      mimeType = 'application/pdf';
    } else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      mimeType = 'image/jpeg';
    } else if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      mimeType = 'image/png';
    } else if (filename.endsWith('.pdf')) mimeType = 'application/pdf';
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

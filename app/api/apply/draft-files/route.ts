/**
 * Multipart application file upload / restore / delete.
 * Writes under the final application path while status=draft.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import { canAccessAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import {
  documents,
  passportServices,
  users,
  visaApplications,
} from '@/lib/db/schema';
import { uploadService } from '@/lib/upload';
import {
  APPLICATION_UPLOAD_FOLDER,
  buildApplicationObjectKey,
  extensionFromMime,
  isApplicationObjectKey,
  isDraftObjectKey,
} from '@/lib/upload/applicationKey';
import { readStoredObject } from '@/lib/upload/readStoredObject';
import { assertSafeStorageKey } from '@/lib/upload/safeStorageKey';
import { deleteOtherSlotExtensionKeys } from '@/lib/upload/deleteSlotSiblings';
import { upsertApplicationDocumentRow } from '@/lib/upload/upsertApplicationDocumentRow';

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

async function resolveDraftApplication(input: {
  applicationId: string;
  ownerUserId: string;
}): Promise<
  | {
      ok: true;
      applicationType: 'visa' | 'passport';
      countryCode: string;
      listingId: string;
    }
  | { ok: false; error: string }
> {
  const [visa] = await db
    .select({
      id: visaApplications.id,
      userId: visaApplications.userId,
      status: visaApplications.status,
      countryCode: visaApplications.countryCode,
      listingId: visaApplications.visaListingId,
    })
    .from(visaApplications)
    .where(eq(visaApplications.id, input.applicationId))
    .limit(1);

  if (visa) {
    if (visa.userId !== input.ownerUserId) {
      return { ok: false, error: 'Unauthorized' };
    }
    if (visa.status !== 'draft') {
      return { ok: false, error: 'Application is no longer a draft' };
    }
    if (!visa.listingId || !visa.countryCode) {
      return { ok: false, error: 'Draft application is incomplete' };
    }
    return {
      ok: true,
      applicationType: 'visa',
      countryCode: visa.countryCode,
      listingId: visa.listingId,
    };
  }

  const [passport] = await db
    .select({
      id: passportServices.id,
      userId: passportServices.userId,
      status: passportServices.status,
      listingId: passportServices.passportListingId,
    })
    .from(passportServices)
    .where(eq(passportServices.id, input.applicationId))
    .limit(1);

  if (!passport) {
    return { ok: false, error: 'Draft application not found' };
  }
  if (passport.userId !== input.ownerUserId) {
    return { ok: false, error: 'Unauthorized' };
  }
  if (passport.status !== 'draft') {
    return { ok: false, error: 'Application is no longer a draft' };
  }
  if (!passport.listingId) {
    return { ok: false, error: 'Draft application is incomplete' };
  }

  return {
    ok: true,
    applicationType: 'passport',
    countryCode: 'IN',
    listingId: passport.listingId,
  };
}

function keyBelongsToOwner(
  key: string,
  ownerUserId: string,
  applicationId?: string | null
): boolean {
  if (applicationId && isApplicationObjectKey(key, ownerUserId, applicationId)) {
    return true;
  }
  // Allow reading abandoned legacy /drafts/ keys during transition.
  return isDraftObjectKey(key, ownerUserId);
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
    const applicationId = String(form.get('applicationId') || '').trim();
    const listingId = String(form.get('listingId') || '').trim();
    const countryCode = String(form.get('countryCode') || '').trim();
    const passengerId = String(form.get('passengerId') || '').trim();
    const slotKey = String(form.get('slotKey') || '').trim();
    const ownerUserIdRaw = form.get('ownerUserId');
    const ownerUserId =
      typeof ownerUserIdRaw === 'string' ? ownerUserIdRaw.trim() : null;
    const file = form.get('file');

    if (!applicationId || !passengerId || !slotKey) {
      return NextResponse.json(
        { error: 'Missing applicationId, passengerId, or slotKey' },
        { status: 400 }
      );
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

    const draft = await resolveDraftApplication({
      applicationId,
      ownerUserId: owner.ownerUserId,
    });
    if (!draft.ok) {
      return NextResponse.json({ error: draft.error }, { status: 403 });
    }

    const resolvedListingId = listingId || draft.listingId;
    const resolvedCountryCode = (countryCode || draft.countryCode).toUpperCase();

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.includes(mimeType as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
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
    const explicitKey = buildApplicationObjectKey({
      countryCode: resolvedCountryCode,
      listingId: resolvedListingId,
      userId: owner.ownerUserId,
      applicationId,
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
        listingId: resolvedListingId,
        applicationId,
        ownerUserId: owner.ownerUserId,
      },
    });

    if (
      previousStorageKey &&
      previousStorageKey !== result.key &&
      keyBelongsToOwner(previousStorageKey, owner.ownerUserId, applicationId)
    ) {
      try {
        await uploadService.delete({
          key: assertSafeStorageKey(previousStorageKey),
        });
      } catch (error) {
        console.warn(
          '[Draft] Failed to delete previous key:',
          previousStorageKey,
          error
        );
      }
    }
    await deleteOtherSlotExtensionKeys(result.key);

    await upsertApplicationDocumentRow(db, {
      applicationId,
      applicationType: draft.applicationType,
      passengerId,
      slotKey,
      previousKey: previousStorageKey || null,
      key: result.key,
      filename: result.filename || uploadFilename,
      size: result.size,
      mimeType: result.mimeType || effectiveMime,
      now: new Date(),
    });

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
    const applicationId = searchParams.get('applicationId');

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
    if (!keyBelongsToOwner(storageKey, owner.ownerUserId, applicationId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const filename = storageKey.split('/').pop() || 'document.bin';
    const stored = await readStoredObject(storageKey);
    if (!stored) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const buffer = stored.buffer;
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
      applicationId?: string;
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
    if (
      !keyBelongsToOwner(
        storageKey,
        owner.ownerUserId,
        body?.applicationId ?? null
      )
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await uploadService.delete({ key: storageKey });

    if (body?.applicationId) {
      await db
        .delete(documents)
        .where(
          and(
            eq(documents.applicationId, body.applicationId),
            eq(documents.s3Key, storageKey),
            or(
              eq(documents.applicationType, 'visa'),
              eq(documents.applicationType, 'passport')
            )
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('draft-files DELETE error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}

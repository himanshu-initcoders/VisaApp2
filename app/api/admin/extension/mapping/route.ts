import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { formFieldMappings } from '@/lib/db/schema';
import { readExtensionStaff } from '@/lib/extension/token';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  formId: z.string().uuid(),
  formType: z.literal('visa'),
  hostname: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9.:[\]-]+$/i),
});

const postSchema = querySchema.extend({
  mapping: z.record(z.string(), z.unknown()),
});

const MAX_MAPPING_CHARS = 500_000;

export async function GET(request: NextRequest) {
  const staff = await readExtensionStaff(request);
  if (!staff) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    formId: request.nextUrl.searchParams.get('formId'),
    formType: request.nextUrl.searchParams.get('formType'),
    hostname: request.nextUrl.searchParams.get('hostname'),
  });
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid mapping query.' }, { status: 400 });
  }

  const { formId, formType, hostname } = parsed.data;
  const [row] = await db
    .select({ mapping: formFieldMappings.mapping })
    .from(formFieldMappings)
    .where(
      and(
        eq(formFieldMappings.formId, formId),
        eq(formFieldMappings.formType, formType),
        eq(formFieldMappings.hostname, hostname)
      )
    )
    .limit(1);

  return NextResponse.json({ mapping: row?.mapping ?? {} });
}

export async function POST(request: NextRequest) {
  const staff = await readExtensionStaff(request);
  if (!staff) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid mapping.' }, { status: 400 });
  }

  if (JSON.stringify(parsed.data.mapping).length > MAX_MAPPING_CHARS) {
    return NextResponse.json({ message: 'Mapping is too large.' }, { status: 413 });
  }

  const { formId, formType, hostname, mapping } = parsed.data;
  const now = new Date();

  await db
    .insert(formFieldMappings)
    .values({
      formId,
      formType,
      hostname,
      mapping,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        formFieldMappings.formId,
        formFieldMappings.formType,
        formFieldMappings.hostname,
      ],
      set: { mapping, updatedAt: now },
    });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { readExtensionStaff } from '@/lib/extension/token';
import { listPublishedExtensionForms } from '@/lib/extension/applications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const staff = await readExtensionStaff(request);
  if (!staff) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const forms = await listPublishedExtensionForms();
  return NextResponse.json(forms);
}

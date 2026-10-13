import { NextRequest, NextResponse } from 'next/server';
import { readExtensionStaff } from '@/lib/extension/token';
import { getExtensionApplication } from '@/lib/extension/applications';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const staff = await readExtensionStaff(request);
  if (!staff) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const payload = await getExtensionApplication(staff, decodeURIComponent(id));
  if (!payload) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(payload);
}

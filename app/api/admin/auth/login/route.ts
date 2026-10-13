import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { signExtensionToken } from '@/lib/extension/token';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Email and password are required.' },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user?.passwordHash) {
    return NextResponse.json(
      { message: 'Invalid email or password.' },
      { status: 401 }
    );
  }

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json(
      { message: 'Invalid email or password.' },
      { status: 401 }
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { message: 'Please verify your email before logging in.' },
      { status: 403 }
    );
  }

  if (user.deactivatedAt) {
    return NextResponse.json(
      { message: 'This account has been deactivated.' },
      { status: 403 }
    );
  }

  if (user.role !== 'admin' && user.role !== 'reviewer') {
    return NextResponse.json(
      { message: 'This account cannot use FormBridge.' },
      { status: 403 }
    );
  }

  const token = await signExtensionToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const firstName = user.name.trim().split(/\s+/)[0] || user.email;

  return NextResponse.json({
    token,
    admin: { email: user.email, firstName },
  });
}

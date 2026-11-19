import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import { notifyUserWelcome } from '@/lib/email/notify';
import { notifyUserWelcomeWhatsApp } from '@/lib/whatsapp/notify';
import { users } from '@/lib/db/schema';
import { normalizeIndianPhone } from '@/lib/auth/phone';
import { registerSchema } from '@/lib/validations/auth';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/register
 *
 * Register a new user (password path — staff/legacy).
 *
 * Request body:
 * - name: string
 * - email: string
 * - phone?: string
 * - password: string
 * - confirmPassword: string
 *
 * Security:
 * - Validates input with Zod
 * - Email is not unique; phone is unique when provided
 * - Hashes password with bcrypt (12 rounds)
 * - Never returns password hash
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone, password } = parsed.data;
    const normalizedPhone = phone
      ? normalizeIndianPhone(phone) ?? phone
      : null;

    if (normalizedPhone) {
      const [phoneTaken] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, normalizedPhone))
        .limit(1);

      if (phoneTaken) {
        return NextResponse.json(
          { error: 'Mobile number already registered' },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hash(password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        phone: normalizedPhone,
        passwordHash,
        role: 'user',
        emailVerified: null,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
      });

    await notifyUserWelcome({
      name: newUser.name,
      email: newUser.email,
    });
    await notifyUserWelcomeWhatsApp({
      userId: newUser.id,
      name: newUser.name,
      phone: newUser.phone,
    });

    return NextResponse.json(
      {
        success: true,
        user: newUser,
        message:
          'Account created successfully. Please check your email for a welcome message.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

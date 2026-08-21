import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { registerSchema } from '@/lib/validations/auth';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/register
 *
 * Register a new user
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
 * - Checks for existing email
 * - Hashes password with bcrypt (12 rounds)
 * - Never returns password hash
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone, password } = parsed.data;

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password (12 rounds for strong security)
    const passwordHash = await hash(password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: 'user',
        emailVerified: false, // Will be verified via email
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });

    // TODO: Send verification email
    // await sendVerificationEmail(newUser.email, verificationToken);

    return NextResponse.json(
      {
        success: true,
        user: newUser,
        message: 'Account created successfully. Please check your email to verify your account.',
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

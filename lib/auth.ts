import NextAuth, { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { normalizeIndianPhone } from '@/lib/auth/phone';
import { verifyOtpAndEnsureUser } from '@/lib/auth/otp';

/**
 * NextAuth Configuration
 *
 * - Email/password credentials (admins)
 * - Phone OTP credentials (applicants) — mock OTP always passes
 */

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const { email, password } = loginSchema.parse(credentials);

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user || !user.passwordHash) {
            return null;
          }

          const isValidPassword = await compare(password, user.passwordHash);
          if (!isValidPassword) {
            return null;
          }

          if (!user.emailVerified) {
            throw new Error('Please verify your email before logging in');
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone ?? undefined,
            emailVerified: Boolean(user.emailVerified),
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),

    CredentialsProvider({
      id: 'phone-otp',
      name: 'Phone OTP',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const phone = normalizeIndianPhone(String(credentials?.phone ?? ''));
          const otp = String(credentials?.otp ?? '');
          if (!phone) return null;

          const result = await verifyOtpAndEnsureUser({ phone, otp });
          if (!result.success) {
            throw new Error(result.error);
          }

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, result.userId))
            .limit(1);

          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone ?? phone,
            emailVerified: Boolean(user.emailVerified),
          };
        } catch (error) {
          console.error('Phone OTP auth error:', error);
          return null;
        }
      },
    }),
  ],

  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.emailVerified = Boolean(user.emailVerified);
        token.phone = user.phone;
      }

      // On session.update(): re-read allowlisted fields from DB only.
      // Never trust client-supplied role, phone, or other sensitive values.
      if (trigger === 'update' && token.id) {
        const [row] = await db
          .select({
            name: users.name,
            // Re-assert sensitive fields from DB so forged client payloads cannot escalate
            role: users.role,
            phone: users.phone,
          })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);

        if (row) {
          token.name = row.name;
          token.role = row.role;
          token.phone = row.phone ?? undefined;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.phone = (token.phone as string | undefined) ?? null;
        if (typeof token.name === 'string') {
          session.user.name = token.name;
        }
        (session.user as { emailVerified?: boolean }).emailVerified =
          Boolean(token.emailVerified);
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
} from '@/components/ui';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';

/**
 * Admin / staff email-password login.
 * Applicants should use /signin (mobile OTP).
 */
export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    if (session.user.role === 'admin' || session.user.role === 'reviewer') {
      router.replace('/admin');
    } else {
      router.replace('/dashboard');
    }
  }, [status, session, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      router.refresh();
      router.push('/admin');
    } catch {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="font-basier text-2xl">
          Staff{' '}
          <span className="italic bg-gradient-rainbow bg-clip-text text-transparent">
            login
          </span>
        </CardTitle>
        <CardDescription>
          Email and password for admin and reviewer accounts
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 rounded-input bg-red-50 border border-red-200">
              <p className="font-switzer text-sm text-red-600">{error}</p>
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            disabled={isLoading}
            {...register('email')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            disabled={isLoading}
            {...register('password')}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-ash text-portrait-ink focus:ring-2 focus:ring-portrait-ink"
              />
              <span className="font-switzer text-sm text-portrait-ink">
                Remember me
              </span>
            </label>

            <Link
              href="/forgot-password"
              className="font-switzer text-sm text-portrait-ink hover:opacity-80 transition-opacity"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex-col space-y-3">
        <p className="text-center font-switzer text-sm text-slate-helper">
          Applying for a visa?{' '}
          <Link
            href="/signin"
            className="font-medium text-portrait-ink hover:opacity-80"
          >
            Sign in with mobile OTP
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

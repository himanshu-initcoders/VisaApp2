'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input } from '@/components/ui';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';

/**
 * Login Page
 *
 * Features:
 * - Email/password authentication
 * - Client-side validation with Zod
 * - Error handling
 * - Link to register page
 * - Portrait design system styling
 */
export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Redirect to admin on success
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="font-basier text-2xl">
          Welcome{' '}
          <span className="italic bg-gradient-rainbow bg-clip-text text-transparent">
            back
          </span>
        </CardTitle>
        <CardDescription>
          Sign in to your account to continue
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
        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ash"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white font-switzer text-slate-helper">
              Don't have an account?
            </span>
          </div>
        </div>

        <Link href="/register" className="w-full">
          <Button variant="ghost" size="lg" className="w-full">
            Create account
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

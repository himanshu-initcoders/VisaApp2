'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input } from '@/components/ui';
import { registerSchema, type RegisterInput } from '@/lib/validations/auth';

/**
 * Register Page
 *
 * Features:
 * - User registration form
 * - Client-side validation with Zod
 * - Server-side validation via API
 * - Error handling
 * - Password strength indicator
 * - Link to login page
 * - Portrait design system styling
 */
export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password');

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // Redirect to login with success message
      router.push('/login?registered=true');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  // Simple password strength indicator
  const getPasswordStrength = (pwd: string): { strength: number; text: string; color: string } => {
    if (!pwd) return { strength: 0, text: '', color: '' };

    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    if (strength <= 2) return { strength, text: 'Weak', color: 'bg-red-500' };
    if (strength === 3) return { strength, text: 'Fair', color: 'bg-yellow-500' };
    if (strength === 4) return { strength, text: 'Good', color: 'bg-blue-500' };
    return { strength, text: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="font-basier text-2xl">
          Create{' '}
          <span className="italic bg-gradient-rainbow bg-clip-text text-transparent">
            account
          </span>
        </CardTitle>
        <CardDescription>
          Sign up to start your visa journey
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
            label="Full Name"
            type="text"
            placeholder="Priya Sharma"
            error={errors.name?.message}
            disabled={isLoading}
            {...register('name')}
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            disabled={isLoading}
            {...register('email')}
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            placeholder="9876543210"
            helperText="10-digit Indian phone number"
            error={errors.phone?.message}
            disabled={isLoading}
            {...register('phone')}
          />

          <div>
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              disabled={isLoading}
              {...register('password')}
            />
            {password && (
              <div className="mt-2">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 h-2 bg-mist rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                  <span className="font-switzer text-xs text-slate-helper">
                    {passwordStrength.text}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            disabled={isLoading}
            {...register('confirmPassword')}
          />

          <div className="flex items-start space-x-2">
            <input
              type="checkbox"
              required
              className="w-4 h-4 mt-0.5 rounded border-ash text-portrait-ink focus:ring-2 focus:ring-portrait-ink"
            />
            <label className="font-switzer text-sm text-portrait-ink">
              I agree to the{' '}
              <Link href="/terms" className="text-portrait-ink underline hover:opacity-80">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-portrait-ink underline hover:opacity-80">
                Privacy Policy
              </Link>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
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
              Already have an account?
            </span>
          </div>
        </div>

        <Link href="/login" className="w-full">
          <Button variant="ghost" size="lg" className="w-full">
            Sign in
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

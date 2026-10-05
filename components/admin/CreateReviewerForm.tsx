'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createReviewerSchema,
  type CreateReviewerInput,
} from '@/lib/validations/auth';
import { createReviewer } from '@/app/(admin)/actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function CreateReviewerForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateReviewerInput>({
    resolver: zodResolver(createReviewerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: CreateReviewerInput) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const result = await createReviewer(data);

      if (!result.success) {
        setFormError(result.error || result.message || 'Failed to create reviewer');
        return;
      }

      router.push('/admin/users');
      router.refresh();
    } catch (error) {
      console.error('Error creating reviewer:', error);
      setFormError('Failed to create reviewer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-ash-divider rounded-3xl p-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
        <section className="space-y-6">
          <div>
            <h2 className="font-basier text-xl font-medium text-portrait-ink mb-2">
              Reviewer details
            </h2>
            <p className="font-switzer text-sm text-slate-helper">
              This person can review applications. They sign in with email and password.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Name"
              placeholder="Priya Sharma"
              autoComplete="name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />

            <Input
              label="Email"
              type="email"
              placeholder="priya@example.com"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />

            <Input
              label="Phone"
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              autoComplete="tel"
              maxLength={10}
              helperText="10-digit Indian mobile starting with 6–9"
              error={form.formState.errors.phone?.message}
              {...form.register('phone')}
            />
          </div>
        </section>

        <section className="border-t border-ash-divider pt-8 space-y-6">
          <div>
            <h2 className="font-basier text-xl font-medium text-portrait-ink mb-2">
              Password
            </h2>
            <p className="font-switzer text-sm text-slate-helper">
              At least 8 characters, with uppercase, lowercase, a number, and a special character.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Password"
              type="password"
              showPasswordToggle
              autoComplete="new-password"
              disabled={isSubmitting}
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />

            <Input
              label="Confirm password"
              type="password"
              showPasswordToggle
              autoComplete="new-password"
              disabled={isSubmitting}
              error={form.formState.errors.confirmPassword?.message}
              {...form.register('confirmPassword')}
            />
          </div>
        </section>

        {formError && (
          <p className="font-switzer text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}

        <div className="flex gap-3 pt-6 border-t border-ash-divider">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create reviewer'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => router.push('/admin/users')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

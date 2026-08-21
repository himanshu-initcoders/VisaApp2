'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCountrySchema,
  type CreateCountryFormValues,
} from '@/lib/validations/config';
import { createCountry } from '@/app/(admin)/admin/config/countries/actions';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';

export function CreateCountryForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateCountryFormValues>({
    resolver: zodResolver(createCountrySchema),
    defaultValues: {
      name: '',
      iso2Code: '',
      enabled: true,
      supported: true,
    },
  });

  const onSubmit = async (data: CreateCountryFormValues) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const result = await createCountry(data);

      if (!result.success || !result.iso2Code) {
        setFormError(result.error || 'Failed to create country');
        return;
      }

      router.push(`/admin/config/countries/${result.iso2Code}`);
      router.refresh();
    } catch (error) {
      console.error('Error creating country:', error);
      setFormError('Failed to create country');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-ash-divider rounded-3xl p-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="space-y-6">
          <div>
            <h2
              className="text-xl font-medium text-portrait-ink mb-2"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Country Details
            </h2>
            <p className="text-sm text-slate-helper">
              Create a destination country. Images and SEO can be added on the detail page.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Country Name"
              placeholder="Thailand"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />

            <Input
              label="ISO2 Code"
              placeholder="TH"
              maxLength={2}
              helperText="Two-letter country code (e.g. TH, AE, JP)"
              error={form.formState.errors.iso2Code?.message}
              {...form.register('iso2Code', {
                onChange: (e) => {
                  e.target.value = e.target.value.toUpperCase();
                },
              })}
            />
          </div>
        </section>

        <section className="border-t border-ash-divider pt-8 space-y-6">
          <div>
            <h2
              className="text-xl font-medium text-portrait-ink mb-2"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Availability
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Checkbox
              label="Enabled"
              description="Show this country in public destination lists."
              checked={form.watch('enabled')}
              onChange={(checked) => form.setValue('enabled', checked, { shouldDirty: true })}
            />
            <Checkbox
              label="Supported"
              description="Mark as a supported destination for visa products."
              checked={form.watch('supported')}
              onChange={(checked) => form.setValue('supported', checked, { shouldDirty: true })}
            />
          </div>
        </section>

        {formError && (
          <p className="text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}

        <div className="flex gap-3 pt-6 border-t border-ash-divider">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Country'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => router.push('/admin/config/countries')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

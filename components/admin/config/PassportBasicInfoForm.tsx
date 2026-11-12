'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  passportListingBasicSchema,
  type PassportListingBasic,
} from '@/lib/validations/passport-config';
import { updatePassportListingBasic } from '@/app/(admin)/admin/config/passport-listings/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { passportServiceTypeLabel } from '@/lib/passport/constants';

interface PassportBasicInfoFormProps {
  listingId: string;
  serviceType: string;
  slug: string;
  defaultValues: PassportListingBasic;
}

const ETA_UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];

export function PassportBasicInfoForm({
  listingId,
  serviceType,
  slug,
  defaultValues,
}: PassportBasicInfoFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PassportListingBasic>({
    resolver: zodResolver(passportListingBasicSchema),
    defaultValues,
  });

  const onSubmit = async (data: PassportListingBasic) => {
    setMessage(null);
    setError(null);
    const result = await updatePassportListingBasic(listingId, data);
    if (result.success) {
      setMessage(result.message || 'Saved');
      router.refresh();
    } else {
      setError(result.error || 'Failed to save');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div className="rounded-2xl border border-ash-divider bg-sky-wash/40 px-4 py-3 text-sm text-portrait-ink">
        <p>
          Service type: <strong>{passportServiceTypeLabel(serviceType)}</strong>{' '}
          (fixed — India only)
        </p>
        <p className="mt-1 text-slate-helper">Slug: /passport/{slug.replace(/-passport$/, '')}/apply</p>
      </div>

      <Input
        label="Product name"
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
          Description
        </label>
        <textarea
          className="w-full rounded-2xl border border-ash-divider px-4 py-3 text-sm text-portrait-ink focus:outline-none focus:ring-2 focus:ring-portrait-ink/20"
          rows={4}
          {...form.register('description')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Standard ETA"
          type="number"
          error={form.formState.errors.standardEtaDuration?.message}
          {...form.register('standardEtaDuration', {
            setValueAs: (v) =>
              v === '' || v === null || Number.isNaN(Number(v))
                ? null
                : Number(v),
          })}
        />
        <Select
          label="ETA unit"
          options={[{ value: '', label: '—' }, ...ETA_UNITS]}
          {...form.register('standardEtaUnit', {
            setValueAs: (v) => (v === '' ? null : v),
          })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-portrait-ink">
        <input type="checkbox" {...form.register('isActive')} className="rounded" />
        Active on public site
      </label>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" variant="primary" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Saving…' : 'Save basic info'}
      </Button>
    </form>
  );
}

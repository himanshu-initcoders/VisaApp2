'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { buildProcessHref } from '@/lib/public';
import { normalizeVisaListingSlug } from '@/lib/visa/listingSlug';

interface VisaListingSlugFieldProps {
  countryCode: string;
  value: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

export function VisaListingSlugField({
  countryCode,
  value,
  error,
  registration,
}: VisaListingSlugFieldProps) {
  const segment = normalizeVisaListingSlug(value || '') || 'Japan-Tourism-Visa';
  const code = countryCode.trim();
  const listingPath = code
    ? buildProcessHref(code, segment)
    : `/visa/…/${segment}`;

  return (
    <div className="md:col-span-2">
      <Input
        label="URL slug"
        placeholder="Japan-Tourism-Visa"
        autoCapitalize="off"
        spellCheck={false}
        error={error}
        helperText={`Listing ${listingPath} · Apply ${listingPath}/apply`}
        {...registration}
      />
    </div>
  );
}

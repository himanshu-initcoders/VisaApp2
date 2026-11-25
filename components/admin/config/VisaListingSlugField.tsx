'use client';

import type { ChangeEvent, FocusEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { buildProcessHref } from '@/lib/public';
import {
  normalizeVisaListingSlug,
  sanitizeVisaListingSlugInput,
} from '@/lib/visa/listingSlug';

interface VisaListingSlugFieldProps {
  countryCode: string;
  value: string;
  error?: string;
  registration: UseFormRegisterReturn;
  /** Fired when the user edits the slug (e.g. stop auto-suggest). */
  onEdited?: () => void;
}

export function VisaListingSlugField({
  countryCode,
  value,
  error,
  registration,
  onEdited,
}: VisaListingSlugFieldProps) {
  const { onChange, onBlur, ...rest } = registration;
  const segment = normalizeVisaListingSlug(value || '') || 'australia-tourism-visa';
  const code = countryCode.trim();
  const listingPath = code
    ? buildProcessHref(code, segment)
    : `/visa/…/${segment}`;

  const rewriteValue = (
    event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
    next: string
  ) => {
    if (event.target.value !== next) {
      event.target.value = next;
    }
  };

  return (
    <div className="md:col-span-2">
      <Input
        label="URL slug"
        placeholder="australia-tourism-visa"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        error={error}
        helperText={`Listing ${listingPath} · Apply ${listingPath}/apply`}
        {...rest}
        onChange={(event) => {
          onEdited?.();
          // Keep trailing `-` while typing; don't strip mid-word separators.
          rewriteValue(event, sanitizeVisaListingSlugInput(event.target.value));
          return onChange(event);
        }}
        onBlur={(event) => {
          rewriteValue(event, normalizeVisaListingSlug(event.target.value));
          return onBlur(event);
        }}
      />
    </div>
  );
}

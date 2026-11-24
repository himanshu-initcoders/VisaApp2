'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { processBasicInfoSchema, type ProcessBasicInfo } from '@/lib/validations/config';
import { updateProcessBasicInfo } from '@/app/(admin)/admin/config/visa-listings/actions';
import { VisaListingSlugField } from '@/components/admin/config/VisaListingSlugField';
import { normalizeVisaListingSlug } from '@/lib/visa/listingSlug';
import {
  VISA_PURPOSE_OPTIONS,
  type VisaListingPurpose,
} from '@/lib/visa/purposes';
import {
  PROCESS_TYPE_OPTIONS,
  isDigitalArrivalCard,
  productNoun,
  productNounTitle,
  type ProcessType,
} from '@/lib/visa/processTypes';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';

const TinyMceEditor = dynamic(
  () =>
    import('@/components/admin/config/TinyMceEditor').then(
      (mod) => mod.TinyMceEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-2xl border border-ash-divider bg-sky-wash/40" />
    ),
  }
);

interface ProcessBasicInfoFormProps {
  processId: string;
  countryCode: string;
  initialData: {
    processName: string;
    slug: string;
    processType: ProcessType;
    purpose: VisaListingPurpose;
    processTypeLabel: string | null;
    entryType: string | null;
    processPhysical: boolean;
    standardEtaDuration: number | null;
    standardEtaUnit: 'minutes' | 'hours' | 'days' | 'months' | 'years' | null;
    isMultipleEntry: boolean | null;
    familyEnabled: boolean;
    unsupported: boolean | null;
    isActive?: boolean | null;
    visaOnArrival: boolean | null;
    visaFree: boolean | null;
    withFreeInsurance?: boolean | null;
    showGeneralInfo?: boolean | null;
    showTripDetails?: boolean | null;
    showInsuranceInterest?: boolean | null;
    sourceUrl: string | null;
    description?: string | null;
  };
}

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
] as const;

export function ProcessBasicInfoForm({
  processId,
  countryCode,
  initialData,
}: ProcessBasicInfoFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const hasTinymceKey = Boolean(process.env.NEXT_PUBLIC_TINYMCE_API_KEY);

  const form = useForm<ProcessBasicInfo>({
    resolver: zodResolver(processBasicInfoSchema),
    defaultValues: {
      processName: initialData.processName,
      slug: initialData.slug,
      processType: initialData.processType,
      purpose: initialData.purpose,
      processTypeLabel: initialData.processTypeLabel || '',
      entryType: initialData.entryType || '',
      processPhysical: initialData.processPhysical,
      standardEtaDuration: initialData.standardEtaDuration ?? null,
      standardEtaUnit: initialData.standardEtaUnit ?? null,
      isMultipleEntry: initialData.isMultipleEntry ?? false,
      familyEnabled: initialData.familyEnabled,
      unsupported: initialData.unsupported ?? false,
      isActive: initialData.isActive ?? true,
      visaOnArrival: initialData.visaOnArrival ?? false,
      visaFree: initialData.visaFree ?? false,
      withFreeInsurance: initialData.withFreeInsurance ?? false,
      showGeneralInfo: initialData.showGeneralInfo ?? true,
      showTripDetails: initialData.showTripDetails ?? false,
      showInsuranceInterest: initialData.showInsuranceInterest ?? false,
      sourceUrl: initialData.sourceUrl || '',
      description: initialData.description || '',
    },
  });

  const watchedProcessType = form.watch('processType');
  const isArrivalCard = isDigitalArrivalCard(watchedProcessType);
  const noun = productNoun(watchedProcessType);
  const nounTitle = productNounTitle(watchedProcessType);

  const purposeOptions = useMemo(
    () =>
      isArrivalCard
        ? VISA_PURPOSE_OPTIONS.filter((option) => option.value === 'visa_on_arrival')
        : VISA_PURPOSE_OPTIONS,
    [isArrivalCard]
  );

  useEffect(() => {
    if (!isArrivalCard) return;
    if (form.getValues('purpose') !== 'visa_on_arrival') {
      form.setValue('purpose', 'visa_on_arrival', {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [isArrivalCard, form]);

  const parseOptionalNumber = (value: string) => {
    if (value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const onSubmit = async (data: ProcessBasicInfo) => {
    setIsSubmitting(true);
    setSaveSuccess(false);

    try {
      const result = await updateProcessBasicInfo(processId, data);

      if (!result.success) {
        if (
          (result.field === 'slug' || result.field === 'purpose') &&
          result.error
        ) {
          form.setError(result.field, { message: result.error });
          return;
        }
        alert(result.error || 'Failed to update process details');
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      router.refresh();
    } catch (error) {
      console.error('Error updating process basic info:', error);
      alert('Failed to update process details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-ash-divider rounded-3xl p-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-medium text-portrait-ink mb-2" style={{ fontFamily: 'Basier Circle' }}>
              Core Identity
            </h2>
            <p className="text-sm text-slate-helper">
              Fees and validity/stay packages are managed under Pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label={`${nounTitle} Name`}
              placeholder={isArrivalCard ? 'Thailand Digital Arrival Card' : 'Thailand Tourist Visa'}
              error={form.formState.errors.processName?.message}
              {...form.register('processName')}
            />

            <VisaListingSlugField
              countryCode={countryCode}
              value={form.watch('slug') || ''}
              error={form.formState.errors.slug?.message}
              registration={{
                ...form.register('slug'),
                onBlur: (event) => {
                  const normalized = normalizeVisaListingSlug(event.target.value);
                  if (normalized && normalized !== event.target.value) {
                    form.setValue('slug', normalized, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                  return form.register('slug').onBlur(event);
                },
              }}
            />

            <Input
              label="Process Type Label"
              placeholder={isArrivalCard ? 'TDAC, MDAC, Arrival Card' : 'TDAC, E-Visa, Tourist Visa'}
              error={form.formState.errors.processTypeLabel?.message}
              {...form.register('processTypeLabel')}
            />

            <Select
              label="Process Type"
              options={PROCESS_TYPE_OPTIONS.map((option) => ({ ...option }))}
              error={form.formState.errors.processType?.message}
              {...form.register('processType')}
            />

            <Select
              label="Purpose"
              options={purposeOptions.map((option) => ({ ...option }))}
              error={form.formState.errors.purpose?.message}
              {...form.register('purpose')}
            />

            <Input
              label="Entry Type"
              placeholder="Tourism, B1/B2, Single Entry"
              error={form.formState.errors.entryType?.message}
              {...form.register('entryType')}
            />

            <Input
              label="Official Source URL"
              type="url"
              placeholder="https://..."
              error={form.formState.errors.sourceUrl?.message}
              {...form.register('sourceUrl')}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-portrait-ink mb-2"
            >
              Overview
            </label>
            <p className="mb-2 text-xs text-slate-helper">
              Shown below the Overview tab on the public {noun} listing page.
              Use the visual editor, or the Code toolbar button for raw HTML.
            </p>
            <Controller
              control={form.control}
              name="description"
              render={({ field }) =>
                hasTinymceKey ? (
                  <TinyMceEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    height={280}
                    disabled={isSubmitting}
                  />
                ) : (
                  <textarea
                    id="description"
                    rows={8}
                    placeholder={`<p>Product overview shown on the public ${noun} listing page…</p>`}
                    className="w-full min-h-[160px] resize-y rounded-2xl border border-ash-divider px-4 py-3 font-mono text-sm text-portrait-ink transition-shadow focus:outline-none focus:ring-2 focus:ring-portrait-ink/20"
                    value={field.value || ''}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )
              }
            />
            {form.formState.errors.description && (
              <p className="mt-1 text-sm text-red-600">
                {form.formState.errors.description.message}
              </p>
            )}
            {!hasTinymceKey ? (
              <p className="mt-1.5 text-xs text-slate-helper">
                TinyMCE key missing — editing as HTML.
              </p>
            ) : null}
          </div>

          <Checkbox
            label="With Free Insurance"
            description={`Turn on when this ${noun} package also includes travel insurance cover for the traveler.`}
            checked={form.watch('withFreeInsurance')}
            onChange={(checked) => {
              form.setValue('withFreeInsurance', checked, { shouldDirty: true });
              if (checked) {
                form.setValue('showInsuranceInterest', false, { shouldDirty: true });
              }
            }}
          />
        </section>

        <section className="border-t border-ash-divider pt-8 space-y-6">
          <div>
            <h2 className="text-xl font-medium text-portrait-ink mb-2" style={{ fontFamily: 'Basier Circle' }}>
              Processing Timeline
            </h2>
            <p className="text-sm text-slate-helper">
              Listing-level ETA shown to travelers (same for all price packages).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Standard ETA Duration"
              type="number"
              placeholder="3"
              error={form.formState.errors.standardEtaDuration?.message}
              {...form.register('standardEtaDuration', {
                setValueAs: parseOptionalNumber,
              })}
            />

            <Select
              label="Standard ETA Unit"
              options={[{ value: '', label: 'Select a unit' }, ...UNIT_OPTIONS.map((o) => ({ ...o }))]}
              error={form.formState.errors.standardEtaUnit?.message}
              {...form.register('standardEtaUnit', {
                setValueAs: (value) => value || null,
              })}
            />
          </div>
        </section>

        <section className="border-t border-ash-divider pt-8 space-y-6">
          <div>
            <h2 className="text-xl font-medium text-portrait-ink mb-2" style={{ fontFamily: 'Basier Circle' }}>
              Apply form sections
            </h2>
            <p className="text-sm text-slate-helper">
              Control which built-in sections appear on the public apply form. Additional questions from Form Builder always appear in their own tab when configured.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Checkbox
              label="Personal details"
              description="Passport biodata fields. When off, travellers use Fill Application instead of passport OCR upload."
              checked={form.watch('showGeneralInfo') ?? true}
              onChange={(checked) => form.setValue('showGeneralInfo', checked, { shouldDirty: true })}
            />
            <Checkbox
              label="Trip Details"
              description="Purpose, dates, accommodation, and flight fields on the apply form."
              checked={form.watch('showTripDetails') ?? false}
              onChange={(checked) => form.setValue('showTripDetails', checked, { shouldDirty: true })}
            />
            <Checkbox
              label="Are you looking for visa insurance also? (optional)"
              description="Shows an optional insurance-interest question on the applicant checkout page. Disabled when With Free Insurance is already on."
              checked={form.watch('showInsuranceInterest')}
              disabled={form.watch('withFreeInsurance')}
              onChange={(checked) =>
                form.setValue('showInsuranceInterest', checked, { shouldDirty: true })
              }
            />
          </div>
        </section>

        <section className="border-t border-ash-divider pt-8 space-y-6">
          <div>
            <h2 className="text-xl font-medium text-portrait-ink mb-2" style={{ fontFamily: 'Basier Circle' }}>
              Availability Flags
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Checkbox
              label="Physical Process"
              description="Enable for embassy visits or offline document handoffs."
              checked={form.watch('processPhysical')}
              onChange={(checked) => form.setValue('processPhysical', checked, { shouldDirty: true })}
            />
            <Checkbox
              label="Multiple Entry"
              description="Use when one approval can be used for repeated entries."
              checked={form.watch('isMultipleEntry')}
              onChange={(checked) => form.setValue('isMultipleEntry', checked, { shouldDirty: true })}
            />
            <Checkbox
              label="Family Enabled"
              description="Lets this process be used for grouped traveler flows."
              checked={form.watch('familyEnabled')}
              onChange={(checked) => form.setValue('familyEnabled', checked, { shouldDirty: true })}
            />
            <Checkbox
              label="Visible to travelers"
              description={`When off, this ${noun} is hidden from the public catalog and apply flow.`}
              checked={form.watch('isActive')}
              onChange={(checked) => form.setValue('isActive', checked, { shouldDirty: true })}
            />
            <Checkbox
              label="Unsupported"
              description="Mark as unsupported (coming soon). Distinct from visibility above."
              checked={form.watch('unsupported')}
              onChange={(checked) => form.setValue('unsupported', checked, { shouldDirty: true })}
            />
            {!isArrivalCard ? (
              <>
                <Checkbox
                  label="Visa on Arrival"
                  description="Mark if approval happens at the destination instead of before travel."
                  checked={form.watch('visaOnArrival')}
                  onChange={(checked) => form.setValue('visaOnArrival', checked, { shouldDirty: true })}
                />
                <Checkbox
                  label="Visa Free"
                  description="Use when no prior visa application is needed for the selected purpose."
                  checked={form.watch('visaFree')}
                  onChange={(checked) => form.setValue('visaFree', checked, { shouldDirty: true })}
                />
              </>
            ) : null}
          </div>
        </section>

        <div className="flex gap-3 pt-6 border-t border-ash-divider">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting || saveSuccess}>
            {saveSuccess ? (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Saved!
              </span>
            ) : isSubmitting ? (
              'Saving...'
            ) : (
              'Save Changes'
            )}
          </Button>

          {form.formState.isDirty && !saveSuccess && (
            <p className="text-sm text-slate-helper self-center">You have unsaved changes</p>
          )}
        </div>
      </form>
    </div>
  );
}

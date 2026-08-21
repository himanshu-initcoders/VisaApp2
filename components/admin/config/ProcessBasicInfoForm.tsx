'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { processBasicInfoSchema, type ProcessBasicInfo } from '@/lib/validations/config';
import { updateProcessBasicInfo } from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';

interface ProcessBasicInfoFormProps {
  processId: string;
  initialData: {
    processName: string;
    processType:
      | 'electronic_travel_authorisation'
      | 'afc'
      | 'visa'
      | 'appointment'
      | 'visa_on_arrival'
      | 'sticker_visa'
      | 'visa_free';
    purpose: 'tourism' | 'business' | 'work' | 'study' | 'family' | 'medical' | 'transit';
    processTypeLabel: string | null;
    entryType: string | null;
    processPhysical: boolean;
    standardEtaDuration: number | null;
    standardEtaUnit: 'minutes' | 'hours' | 'days' | 'months' | 'years' | null;
    isMultipleEntry: boolean | null;
    familyEnabled: boolean;
    unsupported: boolean | null;
    visaOnArrival: boolean | null;
    visaFree: boolean | null;
    sourceUrl: string | null;
  };
}

const PROCESS_TYPE_OPTIONS = [
  { value: 'electronic_travel_authorisation', label: 'Electronic Travel Authorisation' },
  { value: 'afc', label: 'Application Facilitation Center' },
  { value: 'visa', label: 'Visa' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'visa_on_arrival', label: 'Visa on Arrival' },
  { value: 'sticker_visa', label: 'Sticker Visa' },
  { value: 'visa_free', label: 'Visa Free' },
] as const;

const PURPOSE_OPTIONS = [
  { value: 'tourism', label: 'Tourism' },
  { value: 'business', label: 'Business' },
  { value: 'work', label: 'Work' },
  { value: 'study', label: 'Study' },
  { value: 'family', label: 'Family' },
  { value: 'medical', label: 'Medical' },
  { value: 'transit', label: 'Transit' },
] as const;

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
] as const;

export function ProcessBasicInfoForm({ processId, initialData }: ProcessBasicInfoFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm<ProcessBasicInfo>({
    resolver: zodResolver(processBasicInfoSchema),
    defaultValues: {
      processName: initialData.processName,
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
      visaOnArrival: initialData.visaOnArrival ?? false,
      visaFree: initialData.visaFree ?? false,
      sourceUrl: initialData.sourceUrl || '',
    },
  });

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
              label="Visa Name"
              placeholder="Thailand TDAC"
              error={form.formState.errors.processName?.message}
              {...form.register('processName')}
            />

            <Input
              label="Process Type Label"
              placeholder="TDAC, E-Visa, Tourist Visa"
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
              options={PURPOSE_OPTIONS.map((option) => ({ ...option }))}
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
              label="Unsupported"
              description="Hide this process from active public traveler journeys."
              checked={form.watch('unsupported')}
              onChange={(checked) => form.setValue('unsupported', checked, { shouldDirty: true })}
            />
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

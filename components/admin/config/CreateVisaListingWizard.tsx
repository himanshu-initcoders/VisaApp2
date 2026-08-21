'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import {
  createVisaListingSchema,
  type CreateVisaListingFormValues,
} from '@/lib/validations/config';
import { createVisaListing } from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import {
  PriceOptionsManager,
  type ListingPrice,
} from '@/components/admin/config/PriceOptionsManager';
import { ComponentsManager } from '@/components/admin/config/ComponentsManager';

type WizardStep = 'basic' | 'pricing' | 'documents';

interface CountryOption {
  name: string;
  iso2Code: string;
}

interface DocumentComponent {
  id: string;
  visaListingId: string;
  key: string;
  amount: string | null;
  chargeable: boolean | null;
  familyEnabled: boolean | null;
  onlyB2b: boolean | null;
  toggle: boolean | null;
  attributes: string[] | null;
  sourceUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}

interface CreateVisaListingWizardProps {
  countries: CountryOption[];
  defaultCountry?: string;
  listingId?: string;
  initialStep?: WizardStep;
  initialPrices?: ListingPrice[];
  initialComponents?: DocumentComponent[];
  listingName?: string;
}

const STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 'basic', label: 'Basic info', description: 'Name, type, and destination' },
  { id: 'pricing', label: 'Pricing', description: 'Validity, stay, and fees' },
  { id: 'documents', label: 'Documents', description: 'Required uploads' },
];

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

function stepIndex(step: WizardStep) {
  return STEPS.findIndex((s) => s.id === step);
}

function parseWizardStep(value?: string): WizardStep {
  if (value === 'pricing' || value === 'documents' || value === 'basic') {
    return value;
  }
  return 'basic';
}

export function CreateVisaListingWizard({
  countries,
  defaultCountry,
  listingId: initialListingId,
  initialStep = 'basic',
  initialPrices = [],
  initialComponents = [],
  listingName,
}: CreateVisaListingWizardProps) {
  const router = useRouter();
  const [listingId, setListingId] = useState(initialListingId);
  const [step, setStep] = useState<WizardStep>(
    initialListingId ? parseWizardStep(initialStep) : 'basic'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState(listingName || '');

  const lockedCountry =
    defaultCountry &&
    countries.some((c) => c.iso2Code === defaultCountry.toUpperCase())
      ? defaultCountry.toUpperCase()
      : undefined;

  const form = useForm<CreateVisaListingFormValues>({
    resolver: zodResolver(createVisaListingSchema),
    defaultValues: {
      processName: '',
      destinationCountry: lockedCountry || '',
      processType: 'visa',
      purpose: 'tourism',
      processTypeLabel: '',
      entryType: '',
      processPhysical: false,
      standardEtaDuration: null,
      standardEtaUnit: null,
      isMultipleEntry: false,
      familyEnabled: false,
      unsupported: false,
      visaOnArrival: false,
      visaFree: false,
      sourceUrl: '',
    },
  });

  const buildWizardUrl = (nextStep: WizardStep, id: string) => {
    const params = new URLSearchParams();
    if (lockedCountry) params.set('country', lockedCountry);
    params.set('id', id);
    params.set('step', nextStep);
    return `/admin/config/visa-listings/new?${params.toString()}`;
  };

  const goToStep = (nextStep: WizardStep, id = listingId) => {
    if (!id && nextStep !== 'basic') return;
    setStep(nextStep);
    if (id) {
      router.replace(buildWizardUrl(nextStep, id));
    }
  };

  const parseOptionalNumber = (value: string) => {
    if (value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const onBasicSubmit = async (data: CreateVisaListingFormValues) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const result = await createVisaListing(data);

      if (!result.success || !result.id) {
        setFormError(result.error || 'Failed to create visa listing');
        return;
      }

      setListingId(result.id);
      setCreatedName(data.processName);
      setStep('pricing');
      router.replace(buildWizardUrl('pricing', result.id));
      router.refresh();
    } catch (error) {
      console.error('Error creating visa listing:', error);
      setFormError('Failed to create visa listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishWizard = () => {
    if (!listingId) return;
    router.push(`/admin/config/visa-listings/${listingId}`);
    router.refresh();
  };

  const cancelHref = lockedCountry
    ? `/admin/config/visa-listings?country=${lockedCountry}`
    : '/admin/config/visa-listings';

  const countryOptions = [
    { value: '', label: 'Select a country' },
    ...countries.map((c) => ({
      value: c.iso2Code,
      label: `${c.name} (${c.iso2Code})`,
    })),
  ];

  const currentIndex = stepIndex(step);

  return (
    <div className="space-y-8">
      <nav aria-label="Add visa steps">
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STEPS.map((item, index) => {
            const isComplete =
              Boolean(listingId) &&
              (index < currentIndex || (item.id === 'basic' && Boolean(listingId)));
            const isCurrent = item.id === step;
            const canNavigate =
              item.id === 'basic'
                ? !listingId
                : Boolean(listingId) && index <= Math.max(currentIndex, 1);

            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!canNavigate && !isCurrent}
                  onClick={() => {
                    if (item.id === 'basic' && listingId) return;
                    if (canNavigate || isCurrent) goToStep(item.id);
                  }}
                  className={cn(
                    'w-full text-left rounded-3xl border px-4 py-4 transition-colors',
                    isCurrent
                      ? 'border-portrait-ink bg-sky-wash'
                      : isComplete
                        ? 'border-ash-divider bg-white'
                        : 'border-ash-divider bg-white opacity-60',
                    canNavigate || isCurrent ? 'cursor-pointer' : 'cursor-not-allowed'
                  )}
                >
                  <p className="text-xs uppercase tracking-wide text-slate-helper mb-1">
                    Step {index + 1}
                  </p>
                  <p
                    className="text-base font-medium text-portrait-ink"
                    style={{ fontFamily: 'Basier Circle' }}
                  >
                    {item.label}
                  </p>
                  <p className="text-sm text-slate-helper mt-1">{item.description}</p>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {(createdName || listingName) && listingId && step !== 'basic' && (
        <p className="text-sm text-slate-helper">
          Configuring{' '}
          <span className="text-portrait-ink font-medium">{createdName || listingName}</span>
        </p>
      )}

      {step === 'basic' && !listingId && (
        <div className="bg-white border border-ash-divider rounded-3xl p-8">
          <form onSubmit={form.handleSubmit(onBasicSubmit)} className="space-y-8">
            <section className="space-y-6">
              <div>
                <h2
                  className="text-xl font-medium text-portrait-ink mb-2"
                  style={{ fontFamily: 'Basier Circle' }}
                >
                  Core Identity
                </h2>
                <p className="text-sm text-slate-helper">
                  Save basic details first, then add pricing and documents in the next steps.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="Destination Country"
                  options={countryOptions}
                  disabled={Boolean(lockedCountry)}
                  error={form.formState.errors.destinationCountry?.message}
                  {...form.register('destinationCountry')}
                />

                <Input
                  label="Visa Name"
                  placeholder="Thailand TDAC"
                  error={form.formState.errors.processName?.message}
                  {...form.register('processName')}
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
                  label="Process Type Label"
                  placeholder="TDAC, E-Visa, Tourist Visa"
                  error={form.formState.errors.processTypeLabel?.message}
                  {...form.register('processTypeLabel')}
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
                <h2
                  className="text-xl font-medium text-portrait-ink mb-2"
                  style={{ fontFamily: 'Basier Circle' }}
                >
                  Processing Timeline
                </h2>
                <p className="text-sm text-slate-helper">
                  Listing-level ETA shown to travelers (optional).
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
                  options={[
                    { value: '', label: 'Select a unit' },
                    ...UNIT_OPTIONS.map((o) => ({ ...o })),
                  ]}
                  error={form.formState.errors.standardEtaUnit?.message}
                  {...form.register('standardEtaUnit', {
                    setValueAs: (value) => value || null,
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
                  Availability Flags
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Checkbox
                  label="Physical Process"
                  description="Enable for embassy visits or offline document handoffs."
                  checked={form.watch('processPhysical')}
                  onChange={(checked) =>
                    form.setValue('processPhysical', checked, { shouldDirty: true })
                  }
                />
                <Checkbox
                  label="Multiple Entry"
                  description="Use when one approval can be used for repeated entries."
                  checked={form.watch('isMultipleEntry')}
                  onChange={(checked) =>
                    form.setValue('isMultipleEntry', checked, { shouldDirty: true })
                  }
                />
                <Checkbox
                  label="Family Enabled"
                  description="Lets this process be used for grouped traveler flows."
                  checked={form.watch('familyEnabled')}
                  onChange={(checked) =>
                    form.setValue('familyEnabled', checked, { shouldDirty: true })
                  }
                />
                <Checkbox
                  label="Unsupported"
                  description="Hide this process from active public traveler journeys."
                  checked={form.watch('unsupported')}
                  onChange={(checked) =>
                    form.setValue('unsupported', checked, { shouldDirty: true })
                  }
                />
                <Checkbox
                  label="Visa on Arrival"
                  description="Mark if approval happens at the destination instead of before travel."
                  checked={form.watch('visaOnArrival')}
                  onChange={(checked) =>
                    form.setValue('visaOnArrival', checked, { shouldDirty: true })
                  }
                />
                <Checkbox
                  label="Visa Free"
                  description="Use when no prior visa application is needed for the selected purpose."
                  checked={form.watch('visaFree')}
                  onChange={(checked) =>
                    form.setValue('visaFree', checked, { shouldDirty: true })
                  }
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
                {isSubmitting ? 'Saving...' : 'Save & continue'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => router.push(cancelHref)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === 'basic' && listingId && (
        <div className="bg-white border border-ash-divider rounded-3xl p-8 space-y-4">
          <p className="text-portrait-ink">
            Basic info for <span className="font-medium">{createdName || listingName}</span> is
            saved. Continue to pricing, or edit details later from the listing hub.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="primary" size="md" onClick={() => goToStep('pricing')}>
              Continue to pricing
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={finishWizard}>
              Open listing hub
            </Button>
          </div>
        </div>
      )}

      {step === 'pricing' && listingId && (
        <div className="space-y-6">
          <div>
            <h2
              className="text-xl font-medium text-portrait-ink mb-2"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Price packages
            </h2>
            <p className="text-sm text-slate-helper">
              Add at least one package if this visa has fees. You can skip and configure later.
            </p>
          </div>

          <PriceOptionsManager processId={listingId} initialPrices={initialPrices} />

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" variant="primary" size="md" onClick={() => goToStep('documents')}>
              Continue to documents
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => goToStep('documents')}>
              Skip for now
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={finishWizard}>
              Finish later
            </Button>
          </div>
        </div>
      )}

      {step === 'documents' && listingId && (
        <div className="space-y-6">
          <div>
            <h2
              className="text-xl font-medium text-portrait-ink mb-2"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Document requirements
            </h2>
            <p className="text-sm text-slate-helper">
              Configure required uploads for applicants. You can skip and add these later.
            </p>
          </div>

          <ComponentsManager processId={listingId} initialComponents={initialComponents} />

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" variant="primary" size="md" onClick={finishWizard}>
              Finish
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => goToStep('pricing')}>
              Back to pricing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

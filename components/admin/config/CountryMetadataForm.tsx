'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { countryMetadataSchema, type CountryMetadata } from '@/lib/validations/config';
import { updateCountryMetadata } from '@/app/(admin)/admin/config/countries/actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';

interface Country {
  id: string;
  name: string;
  iso2Code: string;
  showAuthorizationTag: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  headline: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  heroImageWidth: number | null;
  heroImageHeight: number | null;
  bannerImageUrl: string | null;
  bannerImageAlt: string | null;
  bannerImageWidth: number | null;
  bannerImageHeight: number | null;
  flagLogoUrl: string | null;
}

interface CountryMetadataFormProps {
  country: Country;
}

export function CountryMetadataForm({ country }: CountryMetadataFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm<CountryMetadata>({
    resolver: zodResolver(countryMetadataSchema),
    defaultValues: {
      name: country.name,
      showAuthorizationTag: country.showAuthorizationTag,
      metaTitle: country.metaTitle || '',
      metaDescription: country.metaDescription || '',
      headline: country.headline || '',
      heroImageUrl: country.heroImageUrl || '',
      heroImageAlt: country.heroImageAlt || '',
      heroImageWidth: country.heroImageWidth || undefined,
      heroImageHeight: country.heroImageHeight || undefined,
      bannerImageUrl: country.bannerImageUrl || '',
      bannerImageAlt: country.bannerImageAlt || '',
      bannerImageWidth: country.bannerImageWidth || undefined,
      bannerImageHeight: country.bannerImageHeight || undefined,
      flagLogoUrl: country.flagLogoUrl || '',
    },
  });

  const onSubmit = async (data: CountryMetadata) => {
    setIsSubmitting(true);
    setSaveSuccess(false);

    try {
      const result = await updateCountryMetadata(country.id, data);

      if (!result.success) {
        alert(result.error || 'Failed to update country');
        return;
      }

      // Show success state
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh page
      router.refresh();
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update country');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-ash-divider p-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Country Name"
            placeholder="Thailand"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
        </div>

        {/* SEO */}
        <div className="border-t border-ash-divider pt-6">
          <h3 className="text-lg font-medium text-portrait-ink mb-4">SEO & Marketing</h3>
          <div className="space-y-4">
            <Input
              label="Headline"
              placeholder="Thailand Digital Arrival Card (TDAC)"
              error={form.formState.errors.headline?.message}
              {...form.register('headline')}
            />

            <Input
              label="Meta Title"
              placeholder="Thailand Visa Application - Fast & Easy"
              error={form.formState.errors.metaTitle?.message}
              {...form.register('metaTitle')}
            />

            <div>
              <label className="block text-sm font-medium text-portrait-ink mb-2">
                Meta Description
              </label>
              <textarea
                placeholder="Apply for Thailand visa online. Get approval in 24 hours. Simple process, best prices."
                className="w-full px-4 py-3 border border-ash-divider rounded-2xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow resize-none"
                rows={3}
                {...form.register('metaDescription')}
              />
              {form.formState.errors.metaDescription && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.metaDescription.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="border-t border-ash-divider pt-6">
          <h3 className="text-lg font-medium text-portrait-ink mb-4">Display Options</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-ash-divider text-portrait-ink focus:ring-portrait-ink/20"
              {...form.register('showAuthorizationTag')}
            />
            <div>
              <p className="text-sm font-medium text-portrait-ink">Show Authorization Tag</p>
              <p className="text-xs text-slate-helper">
                Display "Authorized Partner" or similar badge
              </p>
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-6 border-t border-ash-divider">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || saveSuccess}
          >
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

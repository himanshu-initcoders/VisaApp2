'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { LinkedInStyleImageUpload } from './LinkedInStyleImageUpload';
import { ImageGallery } from './ImageGallery';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Image as ImageIcon, FileText, ShieldCheck, Check } from 'lucide-react';

const TinyMceEditor = dynamic(
  () =>
    import('@/components/admin/config/TinyMceEditor').then(
      (mod) => mod.TinyMceEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] animate-pulse rounded-2xl border border-ash-divider bg-sky-wash/30" />
    ),
  }
);

interface CountryImages {
  banner?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  hero?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  flag?: {
    url: string;
  };
}

interface CountrySEO {
  metaTitle?: string;
  metaDescription?: string;
  headline?: string;
}

interface Country {
  id: string;
  name: string;
  iso2Code: string;
  enabled: boolean;
  showAuthorizationTag: boolean;
  images?: CountryImages | null;
  seo?: CountrySEO | null;
  exemption?: string | null;
}

interface CountryProfileCardProps {
  country: Country;
  onUpdate: (data: Partial<Country>) => Promise<void>;
}

type CountryTab = 'images' | 'seo' | 'exemption';

export function CountryProfileCard({ country, onUpdate }: CountryProfileCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CountryTab>('images');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exemptionSaveSuccess, setExemptionSaveSuccess] = useState(false);

  // SEO form state
  const [seoData, setSeoData] = useState<CountrySEO>(country.seo || {});
  const [exemptionHtml, setExemptionHtml] = useState(country.exemption || '');
  const hasTinymceKey = Boolean(process.env.NEXT_PUBLIC_TINYMCE_API_KEY);

  useEffect(() => {
    setSeoData(country.seo || {});
  }, [country.seo]);

  useEffect(() => {
    setExemptionHtml(country.exemption || '');
  }, [country.exemption]);

  const handleImageUpdate = async (type: 'banner' | 'hero' | 'flag', url: string) => {
    const updatedImages = {
      ...country.images,
      [type]: type === 'flag' ? { url } : { url, alt: '', width: undefined, height: undefined },
    };

    await onUpdate({ images: updatedImages });
    router.refresh();
  };

  const handleSEOSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({ seo: seoData });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      router.refresh();
    } catch (error) {
      alert('Failed to save SEO data');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExemptionSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({ exemption: exemptionHtml });
      setExemptionSaveSuccess(true);
      setTimeout(() => setExemptionSaveSuccess(false), 3000);
      router.refresh();
    } catch (error) {
      alert('Failed to save exemption content');
    } finally {
      setIsSaving(false);
    }
  };

  const tabClass = (tab: CountryTab) =>
    `inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'text-portrait-ink border-b-2 border-portrait-ink -mb-px'
        : 'text-slate-helper hover:text-portrait-ink'
    }`;

  return (
    <div className="bg-white rounded-3xl border border-ash-divider overflow-hidden shadow-card">
      {/* Hero Image as Banner - LinkedIn style */}
      <LinkedInStyleImageUpload
        type="banner"
        currentImageUrl={country.images?.hero?.url}
        onSuccess={(url) => handleImageUpdate('hero', url)}
        folder="country-heroes"
        aspectRatio="21/9"
        maxSizeMB={5}
      />

      {/* Profile Section */}
      <div className="relative px-8 pb-6">
        {/* Flag/Logo - LinkedIn style profile pic */}
        <div className="relative -mt-16">
          <LinkedInStyleImageUpload
            type="profile"
            currentImageUrl={country.images?.flag?.url}
            onSuccess={(url) => handleImageUpdate('flag', url)}
            folder="country-flags"
            maxSizeMB={1}
          />
        </div>

        {/* Country Info */}
        <div className="mt-4 mb-6">
          <div className="mb-2">
            <h2
              className="text-[31px] font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
            >
              {country.name}
            </h2>
          </div>
          <div className="flex gap-4 text-sm text-slate-helper">
            <span>Code: {country.iso2Code}</span>
            <span>•</span>
            <span className={country.enabled ? 'text-green-600' : 'text-red-600'}>
              {country.enabled ? '✓ Enabled' : '✗ Disabled'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-ash-divider">
          <button
            type="button"
            className={tabClass('images')}
            onClick={() => setActiveTab('images')}
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            Images
          </button>
          <button
            type="button"
            className={tabClass('seo')}
            onClick={() => setActiveTab('seo')}
          >
            <FileText className="h-4 w-4 shrink-0" />
            SEO & Metadata
          </button>
          <button
            type="button"
            className={tabClass('exemption')}
            onClick={() => setActiveTab('exemption')}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Exemption
          </button>
        </div>

        {/* Images Tab - Gallery View */}
        {activeTab === 'images' && (
          <ImageGallery
            images={country.images}
            onImageUpdate={handleImageUpdate}
          />
        )}

        {/* SEO Tab */}
        {activeTab === 'seo' && (
          <div className="space-y-4">
            <Input
              label="Headline"
              placeholder="Thailand Digital Arrival Card (TDAC)"
              value={seoData.headline || ''}
              onChange={(e) => setSeoData({ ...seoData, headline: e.target.value })}
            />

            <Input
              label="Meta Title"
              placeholder="Thailand Visa Application - Fast & Easy"
              value={seoData.metaTitle || ''}
              onChange={(e) => setSeoData({ ...seoData, metaTitle: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium text-portrait-ink mb-2">
                Meta Description
              </label>
              <textarea
                placeholder="Apply for Thailand visa online. Get approval in 24 hours."
                className="w-full px-4 py-3 border border-ash-divider rounded-2xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow resize-none"
                rows={3}
                value={seoData.metaDescription || ''}
                onChange={(e) => setSeoData({ ...seoData, metaDescription: e.target.value })}
              />
            </div>

            <Button
              onClick={handleSEOSave}
              variant="primary"
              size="md"
              disabled={isSaving || saveSuccess}
            >
              {saveSuccess ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  Saved!
                </span>
              ) : isSaving ? (
                'Saving...'
              ) : (
                'Save SEO Settings'
              )}
            </Button>
          </div>
        )}

        {/* Exemption Tab */}
        {activeTab === 'exemption' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-portrait-ink mb-1">
                Visa exemption content
              </h3>
              <p className="text-sm text-slate-helper mb-4">
                Shown as an Exemption section on public visa listing pages
                (above FAQs). Leave empty to hide the section.
              </p>
              {hasTinymceKey ? (
                <TinyMceEditor
                  value={exemptionHtml}
                  onChange={setExemptionHtml}
                  height={360}
                  disabled={isSaving}
                />
              ) : (
                <textarea
                  rows={12}
                  className="w-full rounded-2xl border border-ash-divider px-4 py-3 font-mono text-sm text-portrait-ink focus:border-nautical-teal focus:outline-none focus:ring-2 focus:ring-nautical-teal/20"
                  value={exemptionHtml}
                  onChange={(e) => setExemptionHtml(e.target.value)}
                  placeholder="<p>Who is exempt from this visa…</p>"
                  disabled={isSaving}
                />
              )}
              {!hasTinymceKey ? (
                <p className="mt-2 text-xs text-slate-helper">
                  TinyMCE key missing — editing as HTML.
                </p>
              ) : null}
            </div>

            <Button
              onClick={handleExemptionSave}
              variant="primary"
              size="md"
              disabled={isSaving || exemptionSaveSuccess}
            >
              {exemptionSaveSuccess ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  Saved!
                </span>
              ) : isSaving ? (
                'Saving...'
              ) : country.exemption ? (
                'Update Exemption'
              ) : (
                'Save Exemption'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

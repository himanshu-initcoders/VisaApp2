'use client';

import { useRouter } from 'next/navigation';
import { ImageUploadV2 } from './ImageUploadV2';
import { updateCountryImage } from '@/app/(admin)/admin/config/countries/actions';

interface Country {
  id: string;
  name: string;
  iso2Code: string;
  bannerImageUrl: string | null;
  bannerImageAlt: string | null;
  bannerImageWidth: number | null;
  bannerImageHeight: number | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  heroImageWidth: number | null;
  heroImageHeight: number | null;
  flagLogoUrl: string | null;
}

interface CountryImagesManagerProps {
  country: Country;
}

export function CountryImagesManager({ country }: CountryImagesManagerProps) {
  const router = useRouter();

  const handleImageSuccess = async (
    imageType: 'banner' | 'hero' | 'flag',
    imageUrl: string,
    altText: string,
    dimensions?: { width?: number; height?: number }
  ) => {
    // Update database with new image URL
    const result = await updateCountryImage(
      country.id,
      imageType,
      imageUrl,
      altText,
      dimensions
    );

    if (result.success) {
      // Refresh page to show new image
      router.refresh();
    } else {
      throw new Error(result.error || 'Failed to update country');
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner Image Section */}
      <section className="bg-white rounded-3xl border border-ash-divider p-8">
        <div className="mb-6">
          <h2
            className="text-[31px] font-medium text-portrait-ink mb-2"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            Banner Image
          </h2>
          <p className="text-sm text-slate-helper">
            Portrait orientation banner displayed on country landing pages. Recommended size:
            600×800px or similar 3:4 ratio.
          </p>
        </div>

        <ImageUploadV2
          label="Banner Image (Portrait)"
          description="Portrait orientation • 3:4 aspect ratio • Max 5MB"
          currentImageUrl={country.bannerImageUrl}
          altText={country.bannerImageAlt || ''}
          dimensions={{
            width: country.bannerImageWidth,
            height: country.bannerImageHeight,
          }}
          onSuccess={(url, alt, dims) => handleImageSuccess('banner', url, alt, dims)}
          folder="country-banners"
          aspectRatio="3/4"
          maxSizeMB={5}
        />

        {country.bannerImageUrl && (
          <div className="mt-6 p-4 bg-mint-wash/30 rounded-2xl">
            <p className="text-xs text-slate-helper mb-2">Current Banner:</p>
            <a
              href={country.bannerImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-nautical-teal hover:underline break-all"
            >
              {country.bannerImageUrl}
            </a>
          </div>
        )}
      </section>

      {/* Hero Image Section */}
      <section className="bg-white rounded-3xl border border-ash-divider p-8">
        <div className="mb-6">
          <h2
            className="text-[31px] font-medium text-portrait-ink mb-2"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            Hero Image
          </h2>
          <p className="text-sm text-slate-helper">
            Landscape hero image for country cards and headers. Recommended size: 1200×675px or
            similar 16:9 ratio.
          </p>
        </div>

        <ImageUploadV2
          label="Hero Image (Landscape)"
          description="Landscape orientation • 16:9 aspect ratio • Max 5MB"
          currentImageUrl={country.heroImageUrl}
          altText={country.heroImageAlt || ''}
          dimensions={{
            width: country.heroImageWidth,
            height: country.heroImageHeight,
          }}
          onSuccess={(url, alt, dims) => handleImageSuccess('hero', url, alt, dims)}
          folder="country-heroes"
          aspectRatio="16/9"
          maxSizeMB={5}
        />

        {country.heroImageUrl && (
          <div className="mt-6 p-4 bg-sky-wash/30 rounded-2xl">
            <p className="text-xs text-slate-helper mb-2">Current Hero:</p>
            <a
              href={country.heroImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-nautical-teal hover:underline break-all"
            >
              {country.heroImageUrl}
            </a>
          </div>
        )}
      </section>

      {/* Flag Logo Section */}
      <section className="bg-white rounded-3xl border border-ash-divider p-8">
        <div className="mb-6">
          <h2
            className="text-[31px] font-medium text-portrait-ink mb-2"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            Flag Logo
          </h2>
          <p className="text-sm text-slate-helper">
            Square flag logo for icons and small displays. Recommended size: 256×256px or similar
            1:1 ratio.
          </p>
        </div>

        <ImageUploadV2
          label="Flag Logo (Square)"
          description="Square • 1:1 aspect ratio • Max 1MB"
          currentImageUrl={country.flagLogoUrl}
          onSuccess={(url, alt) => handleImageSuccess('flag', url, alt)}
          folder="country-flags"
          aspectRatio="1/1"
          maxSizeMB={1}
        />

        {country.flagLogoUrl && (
          <div className="mt-6 p-4 bg-peach-wash/30 rounded-2xl">
            <p className="text-xs text-slate-helper mb-2">Current Flag:</p>
            <a
              href={country.flagLogoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-nautical-teal hover:underline break-all"
            >
              {country.flagLogoUrl}
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

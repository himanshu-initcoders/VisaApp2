'use client';

import { CountryProfileCard } from './CountryProfileCard';
import { updateCountryV2 } from '@/app/(admin)/admin/config/countries/actions-v2';

interface Country {
  id: string;
  name: string;
  iso2Code: string;
  enabled: boolean;
  showAuthorizationTag: boolean;
  images?: any;
  seo?: any;
}

interface CountryProfileCardWrapperProps {
  country: Country;
}

export function CountryProfileCardWrapper({ country }: CountryProfileCardWrapperProps) {
  const handleUpdate = async (data: Partial<Country>) => {
    const result = await updateCountryV2(country.id, data);

    if (!result.success) {
      throw new Error(result.error || 'Failed to update country');
    }
  };

  return <CountryProfileCard country={country} onUpdate={handleUpdate} />;
}

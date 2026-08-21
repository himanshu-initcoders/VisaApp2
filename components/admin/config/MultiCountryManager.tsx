'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Globe, Plus, Trash2 } from 'lucide-react';
import { addMultiTripCountry, removeMultiTripCountry } from '@/app/(admin)/admin/config/visa-listings/actions';

interface MultiCountry {
  id: string;
  visaListingId: string;
  additionalCountryCode: string;
  createdAt: Date;
}

interface Country {
  name: string;
  iso2Code: string;
}

interface MultiCountryManagerProps {
  processId: string;
  initialCountries: MultiCountry[];
  primaryCountry: Country;
}

export function MultiCountryManager({
  processId,
  initialCountries,
  primaryCountry,
}: MultiCountryManagerProps) {
  const router = useRouter();
  const [countries] = useState(initialCountries);
  const [isAdding, setIsAdding] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const handleAdd = async () => {
    if (!countryCode.trim() || countryCode.length !== 2) {
      alert('Please enter a valid 2-letter country code (e.g., KR, VN, MY)');
      return;
    }

    const result = await addMultiTripCountry(processId, {
      additionalCountryCode: countryCode.toUpperCase(),
      sortOrder: 0,
    });

    if (result.success) {
      setCountryCode('');
      setIsAdding(false);
      router.refresh();
    } else {
      alert(result.error || 'Failed to add country');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const result = await removeMultiTripCountry(deletingId);
    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to remove country');
    }
  };

  if (countries.length === 0 && !isAdding) {
    return (
      <>
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="No multi-country support configured"
          description={`This visa is currently only valid for ${primaryCountry.name}. Add additional countries to enable multi-country support.`}
          action={{
            label: 'Add Country',
            onClick: () => setIsAdding(true),
          }}
        />
        {isAdding && (
          <div className="mt-6 p-6 bg-mint-wash/30 rounded-3xl">
            <h4 className="text-sm font-medium text-portrait-ink mb-4">Add Additional Country</h4>
            <div className="flex gap-3">
              <Input
                label=""
                placeholder="2-letter code (e.g., KR, VN, MY)"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                maxLength={2}
              />
              <Button onClick={handleAdd} variant="primary" size="md">
                Add
              </Button>
              <Button onClick={() => setIsAdding(false)} variant="ghost" size="md">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-helper">
          Also valid for {countries.length} additional {countries.length === 1 ? 'country' : 'countries'}
        </p>
        <Button onClick={() => setIsAdding(true)} variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          Add Country
        </Button>
      </div>

      <div className="bg-mint-wash/30 rounded-3xl p-6 mb-6">
        <p className="text-sm font-medium text-portrait-ink mb-4">
          ✈️ Marketing Preview: <span className="text-nautical-teal">1 visa for {countries.length + 1} countries!</span>
        </p>
      </div>

      {isAdding && (
        <div className="p-6 bg-sky-wash/30 rounded-3xl mb-6">
          <h4 className="text-sm font-medium text-portrait-ink mb-4">Add Additional Country</h4>
          <div className="flex gap-3">
            <Input
              label=""
              placeholder="2-letter code (e.g., KR, VN, MY)"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              maxLength={2}
            />
            <Button onClick={handleAdd} variant="primary" size="md">
              Add
            </Button>
            <Button onClick={() => setIsAdding(false)} variant="ghost" size="md">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {countries.map((country) => (
          <div
            key={country.id}
            className="bg-white border border-ash-divider rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getFlag(country.additionalCountryCode)}</span>
              <span className="text-sm font-medium text-portrait-ink">
                {country.additionalCountryCode}
              </span>
            </div>
            <button
              onClick={() => setDeletingId(country.id)}
              className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
              aria-label="Remove country"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Remove Country"
        message="Are you sure you want to remove this country from multi-trip support?"
        confirmText="Remove Country"
        destructive
      />
    </>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/Toggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toggleCountryEnabled } from '@/app/(admin)/admin/config/countries/actions';
import { useRouter } from 'next/navigation';

interface Country {
  id: string;
  name: string;
  iso2Code: string;
  enabled: boolean;
  supported: boolean;
  visaListings: { id: string }[];
}

interface CountriesTableProps {
  countries: Country[];
}

/**
 * CountriesTable Component
 *
 * Displays all countries with:
 * - Flag emoji
 * - Name and ISO2 code
 * - Entry processes count
 * - Enable/disable toggle
 * - Actions (view, edit)
 */
export function CountriesTable({ countries }: CountriesTableProps) {
  const router = useRouter();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    countryId: string;
    countryName: string;
    currentStatus: boolean;
  }>({
    open: false,
    countryId: '',
    countryName: '',
    currentStatus: false
  });
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  // Get flag emoji from ISO2 code
  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const handleToggleClick = (country: Country) => {
    setConfirmDialog({
      open: true,
      countryId: country.id,
      countryName: country.name,
      currentStatus: country.enabled
    });
  };

  const handleConfirmToggle = async () => {
    setToggleLoading(confirmDialog.countryId);

    try {
      const result = await toggleCountryEnabled(confirmDialog.countryId);

      if (result.error) {
        alert(result.error);
      } else {
        // Success - close dialog
        setConfirmDialog({ open: false, countryId: '', countryName: '', currentStatus: false });
        router.refresh();
      }
    } catch (error) {
      alert('Failed to toggle country status');
    } finally {
      setToggleLoading(null);
    }
  };

  if (countries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-helper">
        No countries found
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-3xl border border-ash-divider overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ash-divider">
                <th className="px-6 py-4 text-left">
                  <span className="text-sm font-medium text-portrait-ink" style={{ fontFamily: 'Basier Circle' }}>
                    Country
                  </span>
                </th>
                <th className="px-6 py-4 text-left">
                  <span className="text-sm font-medium text-portrait-ink" style={{ fontFamily: 'Basier Circle' }}>
                    Code
                  </span>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="text-sm font-medium text-portrait-ink" style={{ fontFamily: 'Basier Circle' }}>
                    Visa Listings
                  </span>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="text-sm font-medium text-portrait-ink" style={{ fontFamily: 'Basier Circle' }}>
                    Status
                  </span>
                </th>
                <th className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-portrait-ink" style={{ fontFamily: 'Basier Circle' }}>
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {countries.map((country) => (
                <tr
                  key={country.id}
                  className="border-b border-ash-divider last:border-0 hover:bg-sky-wash transition-colors"
                >
                  {/* Country with Flag */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getFlag(country.iso2Code)}</span>
                      <div>
                        <p className="font-medium text-portrait-ink">{country.name}</p>
                        {!country.supported && (
                          <span className="text-xs text-slate-helper">Not supported</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* ISO2 Code */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-ash-divider text-portrait-ink">
                      {country.iso2Code}
                    </span>
                  </td>

                  {/* Visa Listings Count */}
                  <td className="px-6 py-4 text-center">
                    <span className="font-medium text-portrait-ink">
                      {country.visaListings.length}
                    </span>
                  </td>

                  {/* Status Toggle */}
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <Toggle
                        enabled={country.enabled}
                        onChange={() => handleToggleClick(country)}
                        disabled={toggleLoading === country.id}
                      />
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/config/countries/${country.iso2Code}`}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                          'text-portrait-ink hover:bg-sky-wash'
                        )}
                      >
                        Manage
                      </Link>
                      {country.visaListings.length > 0 && (
                        <Link
                          href={`/admin/config/visa-listings?country=${country.iso2Code}`}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                            'text-portrait-ink hover:bg-mint-wash'
                          )}
                        >
                          Visa Listings →
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, countryId: '', countryName: '', currentStatus: false })}
        onConfirm={handleConfirmToggle}
        title={`${confirmDialog.currentStatus ? 'Disable' : 'Enable'} ${confirmDialog.countryName}?`}
        message={
          confirmDialog.currentStatus
            ? `This will hide ${confirmDialog.countryName} from users. Entry processes will not be available for visa applications. You can re-enable it anytime.`
            : `This will make ${confirmDialog.countryName} visible to users. Entry processes will become available for visa applications.`
        }
        confirmText={confirmDialog.currentStatus ? 'Disable' : 'Enable'}
        loading={toggleLoading === confirmDialog.countryId}
      />
    </>
  );
}

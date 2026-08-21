import Link from 'next/link';
import { getCountriesWithProcessCounts } from '@/lib/db/queries/config';
import { requireRole } from '@/lib/auth-utils';
import { CountriesTable } from '@/components/admin/config/CountriesTable';
import { ConfigEmptyState } from '@/components/admin/config/ConfigEmptyState';
import { Button } from '@/components/ui/Button';
import { Globe } from 'lucide-react';

/**
 * Countries Configuration Page
 *
 * Allows admins to:
 * - View all countries
 * - Enable/disable countries
 * - See entry processes count
 * - Navigate to country details
 * - Add new countries
 */
export default async function CountriesPage() {
  // Require admin role
  await requireRole(['admin']);

  // Fetch all countries with process counts
  const countries = await getCountriesWithProcessCounts();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-[44px] font-medium leading-tight tracking-tight text-portrait-ink mb-2"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
            >
              Countries
            </h1>
            <p className="text-base text-slate-helper">
              Manage visa destination countries and their availability. Enable or disable countries
              to control which visas are offered to users.
            </p>
          </div>
          <Link href="/admin/config/countries/new">
            <Button variant="primary" size="md">
              Add Country
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-ash-divider rounded-3xl p-6">
            <p className="text-sm text-slate-helper mb-1">Total Countries</p>
            <p
              className="text-[44px] font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              {countries.length}
            </p>
          </div>
          <div className="bg-white border border-ash-divider rounded-3xl p-6">
            <p className="text-sm text-slate-helper mb-1">Enabled</p>
            <p
              className="text-[44px] font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              {countries.filter(c => c.enabled).length}
            </p>
          </div>
          <div className="bg-white border border-ash-divider rounded-3xl p-6">
            <p className="text-sm text-slate-helper mb-1">Total Processes</p>
            <p
              className="text-[44px] font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              {countries.reduce((sum, c) => sum + c.visaListings.length, 0)}
            </p>
          </div>
        </div>

        {/* Table or Empty State */}
        {countries.length === 0 ? (
          <ConfigEmptyState
            icon={<Globe className="h-12 w-12" />}
            title="No countries added yet"
            description="Add your first country to start offering visa services."
            actionLabel="Add Country"
            actionHref="/admin/config/countries/new"
          />
        ) : (
          <CountriesTable countries={countries} />
        )}
      </div>
    </div>
  );
}

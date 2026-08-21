import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { CreateCountryForm } from '@/components/admin/config/CreateCountryForm';

/**
 * Add Country — create a new destination country
 */
export default async function NewCountryPage() {
  await requireRole(['admin']);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm mb-4">
            <Link
              href="/admin/config/countries"
              className="text-nautical-teal hover:underline"
            >
              Countries
            </Link>
            <span className="text-slate-helper">/</span>
            <span className="text-portrait-ink">Add Country</span>
          </div>
          <h1
            className="text-[44px] font-medium leading-tight tracking-tight text-portrait-ink mb-2"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
          >
            Add Country
          </h1>
          <p className="text-base text-slate-helper">
            Add a destination country so you can attach visa listings to it.
          </p>
        </div>

        <CreateCountryForm />
      </div>
    </div>
  );
}

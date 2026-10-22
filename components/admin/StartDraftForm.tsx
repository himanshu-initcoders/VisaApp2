'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export interface StartDraftUserOption {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface StartDraftListingOption {
  id: string;
  processName: string;
  countryCode: string;
  countryName: string;
}

interface StartDraftFormProps {
  users: StartDraftUserOption[];
  listings: StartDraftListingOption[];
}

export function StartDraftForm({ users, listings }: StartDraftFormProps) {
  const router = useRouter();
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [listingId, setListingId] = useState(listings[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const selectedListing = useMemo(
    () => listings.find((item) => item.id === listingId),
    [listings, listingId]
  );

  const handleStart = () => {
    setError(null);
    if (!userId) {
      setError('Select an applicant.');
      return;
    }
    if (!selectedListing) {
      setError('Select a visa listing.');
      return;
    }

    const cc = selectedListing.countryCode.toLowerCase();
    router.push(
      `/visa/${cc}/${selectedListing.id}/apply?onBehalfOf=${encodeURIComponent(userId)}&resume=1`
    );
  };

  return (
    <div className="space-y-5 rounded-[24px] border border-ash bg-white p-6">
      <div>
        <label
          htmlFor="draft-user"
          className="font-switzer text-sm font-medium text-portrait-ink"
        >
          Applicant
        </label>
        <select
          id="draft-user"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-ash bg-white px-4 py-3 font-switzer text-sm text-portrait-ink"
        >
          {users.length === 0 && <option value="">No applicants found</option>}
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
              {user.phone ? ` · +91 ${user.phone}` : ''} · {user.email}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="draft-listing"
          className="font-switzer text-sm font-medium text-portrait-ink"
        >
          Visa listing
        </label>
        <select
          id="draft-listing"
          value={listingId}
          onChange={(event) => setListingId(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-ash bg-white px-4 py-3 font-switzer text-sm text-portrait-ink"
        >
          {listings.length === 0 && <option value="">No listings found</option>}
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.countryName} ({listing.countryCode}) ·{' '}
              {listing.processName}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="font-switzer text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={handleStart}
        disabled={!userId || !listingId}
      >
        Open apply form
      </Button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { ProfileAvatar } from '@/components/apply/ProfileAvatar';
import { getFlagEmoji } from '@/lib/public';
import type { TravellerProfile } from '@/lib/apply/travellerProfiles';

interface AddTravellerCardProps {
  disabled?: boolean;
  onAdd: (name: string) => void;
  profiles?: TravellerProfile[];
  /** Saved profiles exist, but each one is already on this application. */
  allProfilesAdded?: boolean;
  showEmptyProfiles?: boolean;
  selectingProfile?: boolean;
  onSelectProfile?: (profile: TravellerProfile) => void;
}

export function AddTravellerCard({
  disabled,
  onAdd,
  profiles = [],
  allProfilesAdded = false,
  showEmptyProfiles = false,
  selectingProfile = false,
  onSelectProfile,
}: AddTravellerCardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    const next = name.trim();
    if (!next || selectingProfile) return;
    onAdd(next);
    setName('');
    setOpen(false);
  };

  const pickProfile = (profile: TravellerProfile) => {
    if (selectingProfile || !onSelectProfile) return;
    onSelectProfile(profile);
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled || selectingProfile}
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add traveller
      </button>
    );
  }

  const showPicker = profiles.length > 0 || allProfilesAdded || showEmptyProfiles;

  return (
    <div className="px-1 pb-1 pt-2">
      <input
        value={name}
        autoFocus
        placeholder="Full name"
        disabled={selectingProfile}
        onChange={(event) =>
          setName(event.target.value.replace(/[^a-zA-Z\s]/g, ''))
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setOpen(false);
            setName('');
          }
        }}
        className="w-full rounded-full border border-ash bg-white px-3 py-2 text-sm text-portrait-ink outline-none placeholder:text-fog focus:border-[#3b82f6] disabled:opacity-60"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={selectingProfile}
          onClick={() => {
            setOpen(false);
            setName('');
          }}
          className="flex-1 rounded-full px-2 py-1.5 text-xs text-slate-helper hover:bg-white disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim() || selectingProfile}
          onClick={commit}
          className="flex-1 rounded-full bg-[#3b82f6] px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {showPicker && (
        <div className="mt-3 border-t border-mist pt-3">
          <p className="px-1 font-switzer text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-helper">
            Previous profiles
          </p>
          {selectingProfile && (
            <p className="mt-2 px-1 font-switzer text-xs text-nautical-teal">
              Restoring answers and documents…
            </p>
          )}
          {profiles.length > 0 ? (
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
              {profiles.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    disabled={selectingProfile}
                    onClick={() => pickProfile(profile)}
                    className="group flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-[#eef4ff] disabled:cursor-wait disabled:opacity-60"
                  >
                    <ProfileAvatar
                      name={profile.name}
                      variant={profile.avatarVariant}
                      className="h-9 w-9 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-switzer text-xs font-semibold text-portrait-ink">
                        {profile.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-helper">
                        <span aria-hidden>{getFlagEmoji(profile.countryCode)}</span>
                        <span className="truncate">{profile.nationality}</span>
                      </span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fog transition-colors group-hover:text-[#3b82f6]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 px-1 font-switzer text-xs leading-relaxed text-slate-helper">
              {allProfilesAdded
                ? 'Everyone saved is already on this application.'
                : 'No previous passengers yet. Submit an application and they’ll show up here.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

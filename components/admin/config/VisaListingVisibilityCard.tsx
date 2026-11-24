'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toggleVisaListingVisibility } from '@/app/(admin)/admin/config/visa-listings/actions';
import { cn } from '@/lib/utils';
import { productNoun } from '@/lib/visa/processTypes';

interface VisaListingVisibilityCardProps {
  processId: string;
  processName: string;
  isActive: boolean;
  processType?: string | null;
}

/**
 * Hub control for visa listing public visibility (Visible / Hidden).
 */
export function VisaListingVisibilityCard({
  processId,
  processName,
  isActive: initialIsActive,
  processType,
}: VisaListingVisibilityCardProps) {
  const noun = productNoun(processType);
  const router = useRouter();
  const [isActive, setIsActive] = useState(initialIsActive);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggleClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await toggleVisaListingVisibility(processId);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (typeof result.isActive === 'boolean') {
        setIsActive(result.isActive);
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      alert('Failed to update visibility status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'mb-8 rounded-2xl border p-5',
          isActive
            ? 'border-mint-wash bg-mint-wash/40'
            : 'border-peach-wash bg-peach-wash/50'
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                isActive ? 'bg-white text-nautical-teal' : 'bg-white text-slate-helper'
              )}
            >
              {isActive ? (
                <Eye className="h-4 w-4 shrink-0" />
              ) : (
                <EyeOff className="h-4 w-4 shrink-0" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-portrait-ink">
                Public visibility
              </p>
              <p className="mt-0.5 text-sm text-slate-helper">
                {isActive
                  ? `This ${noun} is visible to travelers on the public site.`
                  : `This ${noun} is hidden from travelers. They cannot view or apply.`}
              </p>
              <span
                className={cn(
                  'mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                  isActive
                    ? 'bg-white text-nautical-teal'
                    : 'bg-white text-slate-helper'
                )}
              >
                {isActive ? 'Visible' : 'Hidden'}
              </span>
            </div>
          </div>

          <Toggle
            enabled={isActive}
            onChange={handleToggleClick}
            disabled={loading}
            label={isActive ? 'Visible' : 'Hidden'}
            aria-label={`Toggle visibility for ${processName}`}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
        onConfirm={handleConfirm}
        title={isActive ? `Hide this ${noun}?` : `Make this ${noun} visible?`}
        message={
          isActive
            ? `"${processName}" will be removed from the public catalog. Travelers will not see or apply for it until you make it visible again.`
            : `"${processName}" will appear on the public site for travelers (if the country is enabled and the listing is not marked unsupported).`
        }
        confirmText={isActive ? `Hide ${noun}` : 'Make visible'}
        destructive={isActive}
        loading={loading}
      />
    </>
  );
}

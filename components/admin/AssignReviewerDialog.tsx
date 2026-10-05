'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Pencil, UserPen } from 'lucide-react';
import { assignVisaReviewer, searchReviewers } from '@/app/(admin)/actions';
import { cn } from '@/lib/utils';
import type { ReviewerOption } from '@/types/admin';

interface AssignReviewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  assignedReviewerId?: string | null;
  onSuccess?: () => void;
}

export function AssignReviewerDialog({
  isOpen,
  onClose,
  applicationId,
  assignedReviewerId,
  onSuccess,
}: AssignReviewerDialogProps) {
  const [query, setQuery] = useState('');
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setError('');
    setAssigningId(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const handle = setTimeout(async () => {
      setIsLoading(true);
      setError('');
      try {
        const result = await searchReviewers(query);
        if (cancelled) return;
        if (result.success && result.data) {
          setReviewers(result.data);
        } else {
          setReviewers([]);
          setError(result.message || 'Failed to load reviewers');
        }
      } catch {
        if (!cancelled) setError('Failed to load reviewers');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [isOpen, query]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !assigningId) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, assigningId, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const handleSelect = async (reviewerId: string) => {
    setAssigningId(reviewerId);
    setError('');
    try {
      const result = await assignVisaReviewer(applicationId, reviewerId);
      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.message || 'Failed to assign reviewer');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setAssigningId(null);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-portrait-ink/50"
        onClick={() => {
          if (!assigningId) onClose();
        }}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-reviewer-title"
          className="pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-y-auto rounded-[24px] bg-white p-4 shadow-elevated sm:p-6"
        >
          <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
            <h2
              id="assign-reviewer-title"
              className="min-w-0 font-basier text-[28px] leading-tight text-portrait-ink sm:text-[31px]"
            >
              Assign to reviewer
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={Boolean(assigningId)}
              className="text-slate-helper transition-colors hover:text-portrait-ink disabled:opacity-50"
              aria-label="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <label
            htmlFor="reviewer-search"
            className="mb-2 block shrink-0 font-switzer text-sm font-medium text-portrait-ink"
          >
            Search reviewers
          </label>
          <input
            id="reviewer-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            disabled={Boolean(assigningId)}
            className={cn(
              'mb-4 w-full shrink-0 font-switzer text-sm text-portrait-ink',
              'rounded-[16px] border border-ash bg-white px-4 py-3',
              'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />

          <ul className="max-h-[min(22.5rem,70dvh)] space-y-2 overflow-y-auto overscroll-contain">
            {isLoading && reviewers.length === 0 && (
              <li className="font-switzer text-sm text-slate-helper">
                Loading reviewers…
              </li>
            )}
            {!isLoading && reviewers.length === 0 && !error && (
              <li className="font-switzer text-sm text-slate-helper">
                No reviewers found
              </li>
            )}
            {reviewers.map((reviewer) => {
              const isCurrent = reviewer.id === assignedReviewerId;
              const isAssigning = assigningId === reviewer.id;
              return (
                <li
                  key={reviewer.id}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-ash px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
                      {reviewer.name}
                    </p>
                    <p className="truncate font-switzer text-xs text-slate-helper">
                      {reviewer.email}
                    </p>
                    <p className="mt-1 font-switzer text-xs text-portrait-ink">
                      {reviewer.openCount === 1
                        ? '1 open request'
                        : `${reviewer.openCount} open requests`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isCurrent ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isCurrent || Boolean(assigningId)}
                    onClick={() => handleSelect(reviewer.id)}
                  >
                    {isCurrent
                      ? 'Assigned'
                      : isAssigning
                        ? 'Assigning…'
                        : 'Select'}
                  </Button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p className="mt-3 font-switzer text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface AssignReviewerButtonProps {
  applicationId: string;
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
  /** Icon button for the applications table. Detail page keeps the text label. */
  iconOnly?: boolean;
}

/** Compact trigger used in the applications table. */
export function AssignReviewerButton({
  applicationId,
  assignedReviewerId,
  assignedReviewerName,
  iconOnly = false,
}: AssignReviewerButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const label = assignedReviewerName ? 'Reassign reviewer' : 'Assign to reviewer';
  const initial = assignedReviewerName?.trim().charAt(0).toUpperCase() || '';
  const showInitial = iconOnly && Boolean(assignedReviewerName);

  const showNameTip = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect || !assignedReviewerName) return;
    setTip({ x: rect.left + rect.width / 2, y: rect.top });
  };

  return (
    <>
      {!iconOnly && assignedReviewerName ? (
        <p className="font-switzer text-xs text-slate-helper">
          {assignedReviewerName}
        </p>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          assignedReviewerName ? `${label}: ${assignedReviewerName}` : label
        }
        title={showInitial ? undefined : label}
        onMouseEnter={showInitial ? showNameTip : undefined}
        onMouseLeave={showInitial ? () => setTip(null) : undefined}
        onFocus={showInitial ? showNameTip : undefined}
        onBlur={showInitial ? () => setTip(null) : undefined}
        className={
          iconOnly
            ? 'relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-ash bg-white font-switzer text-sm font-semibold text-portrait-ink transition-colors hover:bg-sky-wash'
            : 'font-switzer text-sm font-medium text-nautical-teal transition-colors hover:text-portrait-ink'
        }
      >
        {showInitial ? (
          <>
            <span aria-hidden>{initial}</span>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-[6px] border border-ash bg-white text-portrait-ink">
              <Pencil className="h-2.5 w-2.5" aria-hidden />
            </span>
          </>
        ) : iconOnly ? (
          <UserPen className="h-4 w-4" aria-hidden />
        ) : (
          label
        )}
      </button>
      {showInitial &&
        tip &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[110] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[10px] bg-portrait-ink px-2 py-1 font-switzer text-xs text-white shadow-card"
            style={{ left: tip.x, top: tip.y - 8 }}
          >
            {assignedReviewerName}
          </span>,
          document.body
        )}
      <AssignReviewerDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        applicationId={applicationId}
        assignedReviewerId={assignedReviewerId}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

interface AssignReviewerCardProps {
  applicationId: string;
  assignedReviewerName?: string | null;
  assignedReviewerId?: string | null;
  canAssign: boolean;
}

/** Sidebar card on the visa application detail page. */
export function AssignReviewerCard({
  applicationId,
  assignedReviewerName,
  assignedReviewerId,
  canAssign,
}: AssignReviewerCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Reviewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-switzer text-sm text-portrait-ink">
            {assignedReviewerName || 'Unassigned'}
          </p>
          {canAssign && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setOpen(true)}
            >
              {assignedReviewerName ? 'Reassign reviewer' : 'Assign to reviewer'}
            </Button>
          )}
        </CardContent>
      </Card>
      {canAssign && (
        <AssignReviewerDialog
          isOpen={open}
          onClose={() => setOpen(false)}
          applicationId={applicationId}
          assignedReviewerId={assignedReviewerId}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}

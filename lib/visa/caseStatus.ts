/**
 * Pure visa case-status rules. Safe to import from client components.
 * Database reads and writes live in travellerStatus.ts.
 */

export interface CaseStatusRollup {
  status: string;
  /** Set application reviewed_at when it is still empty. */
  setReviewedAt: boolean;
  /** Set application completed_at when it is still empty. */
  setCompletedAt: boolean;
  /** Clear application completed_at when the case is open again. */
  clearCompletedAt: boolean;
}

const TERMINAL = new Set(['approved', 'rejected']);

export function rollupCaseStatus(statuses: string[]): CaseStatusRollup {
  if (statuses.length === 0) {
    return {
      status: 'submitted',
      setReviewedAt: false,
      setCompletedAt: false,
      clearCompletedAt: true,
    };
  }

  const unique = new Set(statuses);
  const allTerminal = statuses.every((status) => TERMINAL.has(status));

  if (statuses.some((status) => status === 'action_required')) {
    return {
      status: 'action_required',
      setReviewedAt: true,
      setCompletedAt: false,
      clearCompletedAt: true,
    };
  }

  if (allTerminal) {
    if (unique.size === 1 && unique.has('approved')) {
      return {
        status: 'approved',
        setReviewedAt: true,
        setCompletedAt: true,
        clearCompletedAt: false,
      };
    }
    if (unique.size === 1 && unique.has('rejected')) {
      return {
        status: 'rejected',
        setReviewedAt: true,
        setCompletedAt: true,
        clearCompletedAt: false,
      };
    }
    return {
      status: 'partially_approved',
      setReviewedAt: true,
      setCompletedAt: true,
      clearCompletedAt: false,
    };
  }

  if (unique.size === 1) {
    const only = statuses[0];
    if (only === 'under_review') {
      return {
        status: 'under_review',
        setReviewedAt: true,
        setCompletedAt: false,
        clearCompletedAt: true,
      };
    }
    return {
      status: only,
      setReviewedAt: false,
      setCompletedAt: false,
      clearCompletedAt: true,
    };
  }

  return {
    status: 'under_review',
    setReviewedAt: true,
    setCompletedAt: false,
    clearCompletedAt: true,
  };
}

export function attachStatusToTravellers<T extends { passengerId?: string }>(
  stored: T[],
  rows: Array<{ id: string; passengerId: string; name: string; status: string }>
): Array<T & { status?: string; travellerRowId?: string }> {
  if (stored.length === 0) {
    return rows.map((row) => ({
      passengerId: row.passengerId,
      name: row.name,
      status: row.status,
      travellerRowId: row.id,
    })) as unknown as Array<T & { status?: string; travellerRowId?: string }>;
  }

  const byPassenger = new Map(rows.map((row) => [row.passengerId, row]));
  return stored.map((traveller, index) => {
    const key = traveller.passengerId || `traveller-${index}`;
    const row = byPassenger.get(key);
    return {
      ...traveller,
      status: row?.status,
      travellerRowId: row?.id,
    };
  });
}

export function historyForSelectedTraveller<T extends { travellerId: string | null }>(
  history: T[],
  travellerRowId: string | undefined,
  travellerCount: number
): T[] {
  if (!travellerRowId) return history;
  const includeUnscoped = travellerCount <= 1;
  return history.filter(
    (item) =>
      item.travellerId === travellerRowId ||
      (includeUnscoped && item.travellerId == null)
  );
}

/** Second line for multi-person visas. Null when there is only one traveller. */
export function travellerSummaryLabel(
  travellerCount: number,
  approvedCount: number
): string | null {
  if (travellerCount <= 1) return null;
  return `${approvedCount} of ${travellerCount} approved`;
}

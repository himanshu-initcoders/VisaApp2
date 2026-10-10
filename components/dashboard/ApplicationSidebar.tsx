'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { StatusHistoryCard } from '@/components/admin/Timeline';
import { useTravellerSelectionOptional } from '@/components/admin/TravellerSelectionContext';
import { historyForSelectedTraveller } from '@/lib/visa/caseStatus';
import { getMyDocumentPreviewUrl } from '@/app/(dashboard)/actions';
import type {
  DocumentWithVerification,
  StatusHistoryItem,
} from '@/types/admin';

interface ApplicationSidebarProps {
  documents: DocumentWithVerification[];
  statusHistory: StatusHistoryItem[];
}

/**
 * View-only sidebar: status timeline + documents (no admin actions).
 */
export function ApplicationSidebar({
  documents,
  statusHistory,
}: ApplicationSidebarProps) {
  const selection = useTravellerSelectionOptional();

  const visibleDocuments = useMemo(() => {
    if (!selection) return documents;
    return selection.filterDocuments(documents);
  }, [documents, selection]);

  const activeTraveller = selection?.activeTraveller ?? null;
  const travellerLabel =
    selection && selection.travellers.length > 1 && activeTraveller
      ? activeTraveller.name?.trim() ||
        `Traveller ${selection.activeTravellerIndex + 1}`
      : null;

  const customerHistory = useMemo(
    () =>
      historyForSelectedTraveller(
        statusHistory,
        activeTraveller?.travellerRowId,
        selection?.travellers.length ?? 1
      )
        .filter((item) => item.oldStatus !== item.newStatus)
        .map((item) => ({
          ...item,
          changedByName: 'Visa team',
          notes: null,
        })),
    [activeTraveller?.travellerRowId, selection?.travellers.length, statusHistory]
  );

  return (
    <div className="space-y-6">
      <StatusHistoryCard history={customerHistory} subtitle={travellerLabel} />

      <Card>
        <CardHeader>
          <CardTitle>
            Documents
            {travellerLabel ? (
              <span className="mt-1 block font-switzer text-sm font-normal text-slate-helper">
                {travellerLabel}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentViewer
            documents={visibleDocuments}
            getPreviewUrl={getMyDocumentPreviewUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}

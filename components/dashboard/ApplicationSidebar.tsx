'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { Timeline } from '@/components/admin/Timeline';
import { useTravellerSelectionOptional } from '@/components/admin/TravellerSelectionContext';
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

  const travellerLabel =
    selection && selection.travellers.length > 1 && selection.activeTraveller
      ? selection.activeTraveller.name?.trim() ||
        `Traveller ${selection.activeTravellerIndex + 1}`
      : null;

  const customerHistory = useMemo(
    () =>
      statusHistory
        .filter((item) => item.oldStatus !== item.newStatus)
        .map((item) => ({
          ...item,
          changedByName: 'Visa team',
          notes: null,
        })),
    [statusHistory]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline history={customerHistory} />
        </CardContent>
      </Card>

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

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { StatusUpdateModal } from '@/components/admin/StatusUpdateModal';
import { NotesModal } from '@/components/admin/NotesModal';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { Timeline } from '@/components/admin/Timeline';
import { useTravellerSelectionOptional } from '@/components/admin/TravellerSelectionContext';
import type { DocumentWithVerification, StatusHistoryItem } from '@/types/admin';

/**
 * Visa Application Actions — status, history, documents (filtered by active traveller).
 */

interface VisaApplicationActionsProps {
  applicationId: string;
  currentStatus: string;
  documents: DocumentWithVerification[];
  statusHistory: StatusHistoryItem[];
}

export function VisaApplicationActions({
  applicationId,
  currentStatus,
  documents,
  statusHistory,
}: VisaApplicationActionsProps) {
  const router = useRouter();
  const selection = useTravellerSelectionOptional();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  const visibleDocuments = useMemo(() => {
    if (!selection) return documents;
    return selection.filterDocuments(documents);
  }, [documents, selection]);

  const travellerLabel =
    selection && selection.travellers.length > 1 && selection.activeTraveller
      ? selection.activeTraveller.name?.trim() ||
        `Traveller ${selection.activeTravellerIndex + 1}`
      : null;

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Status Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => setShowStatusModal(true)}
          >
            Update Status
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowNotesModal(true)}
          >
            Add Internal Note
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline history={statusHistory} />
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
            onDocumentVerified={handleSuccess}
          />
        </CardContent>
      </Card>

      <StatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        applicationId={applicationId}
        applicationType="visa"
        currentStatus={currentStatus}
        onSuccess={handleSuccess}
      />

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        applicationId={applicationId}
        applicationType="visa"
        onSuccess={handleSuccess}
      />
    </>
  );
}

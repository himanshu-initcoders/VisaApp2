'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { StatusUpdateModal } from '@/components/admin/StatusUpdateModal';
import { NotesModal } from '@/components/admin/NotesModal';
import { RequestCorrectionModal } from '@/components/admin/RequestCorrectionModal';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { StatusHistoryCard } from '@/components/admin/Timeline';
import { useTravellerSelectionOptional } from '@/components/admin/TravellerSelectionContext';
import { historyForSelectedTraveller } from '@/lib/visa/caseStatus';
import type { DocumentWithVerification, StatusHistoryItem } from '@/types/admin';
import type { CorrectableTarget } from '@/lib/visa/corrections';

/**
 * Visa Application Actions — status, history, documents (filtered by active traveller).
 */

interface VisaApplicationActionsProps {
  applicationId: string;
  currentStatus: string;
  documents: DocumentWithVerification[];
  statusHistory: StatusHistoryItem[];
  travellers: Array<{ id: string; name: string }>;
  correctionTargets: CorrectableTarget[];
}

export function VisaApplicationActions({
  applicationId,
  currentStatus,
  documents,
  statusHistory,
  travellers,
  correctionTargets,
}: VisaApplicationActionsProps) {
  const router = useRouter();
  const selection = useTravellerSelectionOptional();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<string | undefined>();

  const visibleDocuments = useMemo(() => {
    if (!selection) return documents;
    return selection.filterDocuments(documents);
  }, [documents, selection]);

  const activeTraveller = selection?.activeTraveller ?? null;
  const statusForUpdate = activeTraveller?.status || currentStatus;
  const visibleHistory = useMemo(
    () =>
      historyForSelectedTraveller(
        statusHistory,
        activeTraveller?.travellerRowId,
        selection?.travellers.length ?? 1
      ),
    [activeTraveller?.travellerRowId, selection?.travellers.length, statusHistory]
  );

  const travellerLabel =
    selection && selection.travellers.length > 1 && activeTraveller
      ? activeTraveller.name?.trim() ||
        `Traveller ${selection.activeTravellerIndex + 1}`
      : null;

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            Status Management
            {travellerLabel ? (
              <span className="mt-1 block font-switzer text-sm font-normal text-slate-helper">
                {travellerLabel}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => setShowStatusModal(true)}
            disabled={!activeTraveller?.travellerRowId}
          >
            Update Status
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setPrefillSlot(undefined);
              setShowCorrectionModal(true);
            }}
            disabled={travellers.length === 0 || correctionTargets.length === 0}
          >
            Request changes
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

      <StatusHistoryCard
        history={visibleHistory}
        subtitle={travellerLabel}
      />

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
            onRequestReupload={(slotKey) => {
              setPrefillSlot(slotKey);
              setShowCorrectionModal(true);
            }}
          />
        </CardContent>
      </Card>

      <StatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        applicationId={applicationId}
        applicationType="visa"
        travellerId={activeTraveller?.travellerRowId}
        travellerName={travellerLabel}
        currentStatus={statusForUpdate}
        onSuccess={handleSuccess}
      />

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        applicationId={applicationId}
        applicationType="visa"
        onSuccess={handleSuccess}
      />

      <RequestCorrectionModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        applicationId={applicationId}
        travellers={travellers}
        targets={correctionTargets}
        initialTravellerId={activeTraveller?.travellerRowId}
        initialSlotKey={prefillSlot}
        onSuccess={handleSuccess}
      />
    </>
  );
}

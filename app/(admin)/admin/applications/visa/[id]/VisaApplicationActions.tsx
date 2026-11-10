'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { StatusUpdateModal } from '@/components/admin/StatusUpdateModal';
import { AttachVisaOutcomeModal } from '@/components/admin/AttachVisaOutcomeModal';
import { NotesModal } from '@/components/admin/NotesModal';
import { RequestCorrectionModal } from '@/components/admin/RequestCorrectionModal';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { StatusHistoryCard } from '@/components/admin/Timeline';
import { useTravellerSelectionOptional } from '@/components/admin/TravellerSelectionContext';
import { historyForSelectedTraveller } from '@/lib/visa/caseStatus';
import {
  VISA_OUTCOME_SLOT,
  visaOutcomeLabel,
} from '@/lib/visa/outcomeDocumentShared';
import type {
  CapturedPaymentForReject,
  DocumentWithVerification,
  RejectTravellerOption,
  StatusHistoryItem,
} from '@/types/admin';
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
  rejectTravellers?: RejectTravellerOption[];
  capturedPayment?: CapturedPaymentForReject | null;
  correctionTargets: CorrectableTarget[];
  /** Slot key → human document name (from form snapshot). */
  documentLabels?: Record<string, string>;
  /** Slot keys that are passport face photos (download menu). */
  passportPhotoKeys?: ReadonlySet<string> | readonly string[];
}

export function VisaApplicationActions({
  applicationId,
  currentStatus,
  documents,
  statusHistory,
  travellers,
  rejectTravellers = [],
  capturedPayment = null,
  correctionTargets,
  documentLabels,
  passportPhotoKeys,
}: VisaApplicationActionsProps) {
  const router = useRouter();
  const selection = useTravellerSelectionOptional();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<string | undefined>();

  const mergedLabels = useMemo(
    () => ({
      ...(documentLabels || {}),
      [VISA_OUTCOME_SLOT]: visaOutcomeLabel(),
    }),
    [documentLabels]
  );

  const visibleDocuments = useMemo(() => {
    if (!selection) return documents;
    return selection.filterDocuments(documents);
  }, [documents, selection]);

  const activeTraveller = selection?.activeTraveller ?? null;
  const statusForUpdate = activeTraveller?.status || currentStatus;
  const canAttachOutcome =
    Boolean(activeTraveller?.travellerRowId) &&
    (activeTraveller?.status || currentStatus) === 'approved';
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
          {canAttachOutcome ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setShowAttachModal(true)}
            >
              Attach visa document
            </Button>
          ) : null}
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
            labelBySlotKey={mergedLabels}
            passportPhotoKeys={passportPhotoKeys}
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
        capturedPayment={capturedPayment}
        travellers={
          rejectTravellers.length > 0
            ? rejectTravellers
            : travellers.map((t) => ({
                id: t.id,
                name: t.name,
                status: 'submitted',
              }))
        }
      />

      {activeTraveller?.travellerRowId ? (
        <AttachVisaOutcomeModal
          isOpen={showAttachModal}
          onClose={() => setShowAttachModal(false)}
          applicationId={applicationId}
          travellerId={activeTraveller.travellerRowId}
          travellerName={travellerLabel}
          onSuccess={handleSuccess}
        />
      ) : null}

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

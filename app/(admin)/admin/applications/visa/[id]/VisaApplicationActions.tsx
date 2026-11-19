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
  DocumentWithVerification,
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
  const isDraft =
    currentStatus === 'draft' || statusForUpdate === 'draft';
  const canUpdateStatus =
    !isDraft &&
    statusForUpdate !== 'approved' &&
    Boolean(activeTraveller?.travellerRowId);
  const canRequestChanges =
    !isDraft &&
    travellers.length > 0 &&
    correctionTargets.length > 0 &&
    statusForUpdate !== 'approved' &&
    statusForUpdate !== 'rejected';
  const canAttachOutcome =
    !isDraft &&
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
          {canUpdateStatus ? (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setShowStatusModal(true)}
            >
              Update Status
            </Button>
          ) : null}
          {canAttachOutcome ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setShowAttachModal(true)}
            >
              Attach visa document
            </Button>
          ) : null}
          {canRequestChanges ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setPrefillSlot(undefined);
                setShowCorrectionModal(true);
              }}
            >
              Request changes
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowNotesModal(true)}
          >
            Add Internal Note
          </Button>
          {isDraft ? (
            <p className="font-switzer text-xs text-slate-helper">
              Draft applications cannot change status or request corrections.
            </p>
          ) : null}
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
            onRequestReupload={
              canRequestChanges
                ? (slotKey) => {
                    setPrefillSlot(slotKey);
                    setShowCorrectionModal(true);
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>

      {canUpdateStatus ? (
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
      ) : null}

      {canAttachOutcome && activeTraveller?.travellerRowId ? (
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

      {canRequestChanges ? (
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
      ) : null}
    </>
  );
}

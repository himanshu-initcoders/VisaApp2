'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { StatusUpdateModal } from '@/components/admin/StatusUpdateModal';
import { NotesModal } from '@/components/admin/NotesModal';
import { RequestCorrectionModal } from '@/components/admin/RequestCorrectionModal';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { StatusHistoryCard } from '@/components/admin/Timeline';
import type { DocumentWithVerification, StatusHistoryItem } from '@/types/admin';
import type { CorrectableTarget } from '@/lib/visa/corrections';

interface PassportApplicationActionsProps {
  applicationId: string;
  currentStatus: string;
  documents: DocumentWithVerification[];
  statusHistory: StatusHistoryItem[];
  documentLabels?: Record<string, string>;
  correctionTargets: CorrectableTarget[];
}

export function PassportApplicationActions({
  applicationId,
  currentStatus,
  documents,
  statusHistory,
  documentLabels,
  correctionTargets,
}: PassportApplicationActionsProps) {
  const router = useRouter();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [prefillSlot, setPrefillSlot] = useState<string | undefined>();

  const handleSuccess = () => {
    router.refresh();
  };

  const isDraft = currentStatus === 'draft';
  const canUpdateStatus = !isDraft && currentStatus !== 'approved';
  const canRequestChanges =
    !isDraft &&
    currentStatus !== 'approved' &&
    currentStatus !== 'rejected';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Status Management</CardTitle>
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

      <StatusHistoryCard history={statusHistory} />

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentViewer
            documents={documents}
            labelBySlotKey={documentLabels}
            onDocumentVerified={handleSuccess}
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
          applicationType="passport"
          currentStatus={currentStatus}
          onSuccess={handleSuccess}
        />
      ) : null}

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        applicationId={applicationId}
        applicationType="passport"
        onSuccess={handleSuccess}
      />

      {canRequestChanges ? (
        <RequestCorrectionModal
          isOpen={showCorrectionModal}
          onClose={() => setShowCorrectionModal(false)}
          applicationId={applicationId}
          applicationType="passport"
          travellers={[]}
          targets={correctionTargets}
          initialSlotKey={prefillSlot}
          onSuccess={handleSuccess}
        />
      ) : null}
    </>
  );
}

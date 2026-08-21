'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { StatusUpdateModal } from '@/components/admin/StatusUpdateModal';
import { NotesModal } from '@/components/admin/NotesModal';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { Timeline } from '@/components/admin/Timeline';
import type { DocumentWithVerification, StatusHistoryItem } from '@/types/admin';

/**
 * Passport Application Actions Component
 *
 * Client-side component for managing passport application actions:
 * - Status updates
 * - Document verification
 * - Adding notes
 */

interface PassportApplicationActionsProps {
  applicationId: string;
  currentStatus: string;
  documents: DocumentWithVerification[];
  statusHistory: StatusHistoryItem[];
}

export function PassportApplicationActions({
  applicationId,
  currentStatus,
  documents,
  statusHistory,
}: PassportApplicationActionsProps) {
  const router = useRouter();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      {/* Status Management */}
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

      {/* Status History */}
      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline history={statusHistory} />
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentViewer
            documents={documents}
            onDocumentVerified={handleSuccess}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <StatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        applicationId={applicationId}
        applicationType="passport"
        currentStatus={currentStatus}
        onSuccess={handleSuccess}
      />

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        applicationId={applicationId}
        applicationType="passport"
        onSuccess={handleSuccess}
      />
    </>
  );
}

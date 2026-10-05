'use client';

import { useState } from 'react';
import { Card, InitialTabs } from '@/components/ui';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import type {
  UserPassengerDocumentGroup,
  DocumentWithVerification,
} from '@/types/admin';

export function UserDocumentsPanel({
  passengers,
  otherDocuments,
}: {
  passengers: UserPassengerDocumentGroup[];
  otherDocuments: DocumentWithVerification[];
}) {
  const items = [
    ...passengers.map((passenger) => ({
      id: passenger.id,
      label: passenger.label,
    })),
    ...(otherDocuments.length > 0
      ? [{ id: 'other', label: 'Other', initial: 'O' }]
      : []),
  ];

  const [activeId, setActiveId] = useState(items[0]?.id ?? '');

  if (items.length === 0) {
    return (
      <Card className="py-12">
        <p className="text-center font-switzer text-sm text-slate-helper">
          No passengers or documents yet
        </p>
      </Card>
    );
  }

  const selectedId = items.some((item) => item.id === activeId)
    ? activeId
    : items[0].id;
  const documents =
    selectedId === 'other'
      ? otherDocuments
      : (passengers.find((passenger) => passenger.id === selectedId)
          ?.documents ?? []);

  return (
    <div className="space-y-4">
      <InitialTabs
        items={items}
        value={selectedId}
        onChange={setActiveId}
        ariaLabel="Select passenger"
      />
      <Card className="shadow-sm">
        <div className="p-6">
          <DocumentViewer documents={documents} />
        </div>
      </Card>
    </div>
  );
}

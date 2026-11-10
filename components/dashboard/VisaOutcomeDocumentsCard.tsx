'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import {
  documentBelongsToTraveller,
  travellerKey,
  useTravellerSelectionOptional,
} from '@/components/admin/TravellerSelectionContext';
import type { AdminStoredTraveller } from '@/components/admin/TravellersSection';
import { getMyDocumentPreviewUrl } from '@/app/(dashboard)/actions';
import {
  VISA_OUTCOME_SLOT,
  visaOutcomeLabel,
} from '@/lib/visa/outcomeDocumentShared';
import type { DocumentWithVerification } from '@/types/admin';

interface VisaOutcomeDocumentsCardProps {
  documents: DocumentWithVerification[];
}

function labelForOutcomeDoc(
  doc: DocumentWithVerification,
  travellers: AdminStoredTraveller[]
): string | null {
  if (travellers.length <= 1) return null;
  const index = travellers.findIndex((traveller, i) =>
    documentBelongsToTraveller(doc, travellerKey(traveller, i))
  );
  if (index < 0) return null;
  const name = travellers[index]?.name?.trim();
  return name || `Traveller ${index + 1}`;
}

export function VisaOutcomeDocumentsCard({
  documents,
}: VisaOutcomeDocumentsCardProps) {
  const selection = useTravellerSelectionOptional();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const outcomeDocs = useMemo(
    () =>
      documents.filter((doc) => doc.documentType === VISA_OUTCOME_SLOT),
    [documents]
  );

  if (outcomeDocs.length === 0) return null;

  const travellers = selection?.travellers ?? [];

  const handleDownload = async (doc: DocumentWithVerification) => {
    setError('');
    setLoadingId(doc.id);
    try {
      const result = await getMyDocumentPreviewUrl(doc.id);
      if (!result.success || !result.data?.url) {
        setError(result.message || result.error || 'Could not open document');
        return;
      }
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Could not open document');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card className="border-mint-wash bg-mint-wash/40">
      <CardHeader>
        <CardTitle>Your visa document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-switzer text-sm text-slate-helper">
          Download your approved visa file
          {outcomeDocs.length > 1 ? 's' : ''} below. Keep a copy for travel.
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {outcomeDocs.map((doc) => {
            const travellerLabel = labelForOutcomeDoc(doc, travellers);
            return (
              <li
                key={doc.id}
                className="flex flex-col gap-3 rounded-[16px] border border-ash bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  {travellerLabel ? (
                    <p className="font-switzer text-xs font-medium uppercase tracking-wide text-nautical-teal">
                      {travellerLabel}
                    </p>
                  ) : null}
                  <p className="mt-1 truncate font-switzer text-sm font-medium text-portrait-ink">
                    {doc.filename || visaOutcomeLabel()}
                  </p>
                  <p className="mt-0.5 font-switzer text-xs text-slate-helper">
                    {visaOutcomeLabel()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto sm:self-start"
                  disabled={loadingId === doc.id}
                  onClick={() => handleDownload(doc)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Download className="h-4 w-4 shrink-0" />
                    {loadingId === doc.id ? 'Opening…' : 'Download'}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
        {error ? (
          <p className="font-switzer text-sm text-red-600">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

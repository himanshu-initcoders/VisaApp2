'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { resolveCorrection } from '@/app/(admin)/actions';
import type { CorrectionRoundView } from '@/lib/visa/corrections';

function valueText(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'filename' in value) {
    const filename = (value as { filename?: string | null }).filename;
    return filename || 'File';
  }
  return JSON.stringify(value);
}

export function CorrectionsCard({
  rounds,
}: {
  rounds: CorrectionRoundView[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (rounds.length === 0) return null;

  const accept = async (requestId: string) => {
    setError('');
    setPendingId(requestId);
    try {
      const result = await resolveCorrection({ requestId });
      if (!result.success) {
        setError(result.message || 'Could not accept the updates');
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {rounds.map((round) => (
          <section key={round.id} className="space-y-3">
            <div>
              <p className="font-switzer text-sm font-semibold text-portrait-ink">
                {round.travellerName} · {round.status.replace(/_/g, ' ')}
              </p>
              <p className="mt-1 font-switzer text-sm text-slate-helper">
                {round.message}
              </p>
            </div>
            <ul className="space-y-2">
              {round.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-ash px-3 py-2 font-switzer text-sm"
                >
                  <p className="font-semibold text-portrait-ink">
                    {item.label}{' '}
                    <span className="font-normal text-slate-helper">
                      · {item.status.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p className="mt-1 text-slate-helper">{item.comment}</p>
                  {item.status !== 'open' && (
                    <p className="mt-2 text-portrait-ink">
                      {valueText(item.previousValue)} → {valueText(item.newValue)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {round.status === 'resubmitted' && (
              <Button
                type="button"
                variant="primary"
                disabled={pendingId === round.id}
                onClick={() => accept(round.id)}
              >
                {pendingId === round.id ? 'Accepting…' : 'Accept updates'}
              </Button>
            )}
          </section>
        ))}
        {error && (
          <p className="font-switzer text-sm text-[#ff4940]" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

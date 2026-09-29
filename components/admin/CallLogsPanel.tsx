'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { AddCallLogForm } from '@/components/admin/AddCallLogForm';
import type { CallLogItem } from '@/types/admin';

interface CallLogsPanelProps {
  applicationId: string;
  logs: CallLogItem[];
  defaultPhone?: string | null;
  /** Hide card title when the parent Tabs label already names this panel. */
  hideTitle?: boolean;
}

/**
 * Call logs list + optional add form (shown only after "Add call log").
 */
export function CallLogsPanel({
  applicationId,
  logs,
  defaultPhone,
  hideTitle = false,
}: CallLogsPanelProps) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <Card>
      {!hideTitle && (
        <CardHeader>
          <CardTitle>Call logs</CardTitle>
        </CardHeader>
      )}
      <CardContent className={hideTitle ? 'space-y-4 pt-6' : 'space-y-4'}>
        {isAdding ? (
          <AddCallLogForm
            applicationId={applicationId}
            defaultPhone={defaultPhone}
            onCancel={() => setIsAdding(false)}
            onSuccess={() => setIsAdding(false)}
          />
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsAdding(true)}
          >
            Add call log
          </Button>
        )}

        <ul className="space-y-3">
          {logs.length === 0 && (
            <li className="font-switzer text-sm text-slate-helper">
              No call logs yet
            </li>
          )}
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-2xl border border-ash bg-sky-wash/40 p-3"
            >
              <p className="font-switzer text-sm text-portrait-ink">
                {log.phone}
              </p>
              <p className="mt-1 whitespace-pre-wrap font-switzer text-sm text-slate-helper">
                {log.note}
              </p>
              <p className="mt-2 text-xs text-slate-helper">
                {log.adminName} ·{' '}
                {new Date(log.createdAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

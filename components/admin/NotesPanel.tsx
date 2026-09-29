'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { AddNoteForm } from '@/components/admin/AddNoteForm';
import type { NoteItem } from '@/types/admin';

interface NotesPanelProps {
  applicationId: string;
  notes: NoteItem[];
  /** Hide card title when the parent Tabs label already names this panel. */
  hideTitle?: boolean;
}

/**
 * Notes list + optional add form (shown only after "Add note").
 */
export function NotesPanel({
  applicationId,
  notes,
  hideTitle = false,
}: NotesPanelProps) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <Card>
      {!hideTitle && (
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
      )}
      <CardContent className={hideTitle ? 'space-y-4 pt-6' : 'space-y-4'}>
        {isAdding ? (
          <AddNoteForm
            applicationId={applicationId}
            applicationType="visa"
            onCancel={() => setIsAdding(false)}
            onSuccess={() => setIsAdding(false)}
          />
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsAdding(true)}
          >
            Add note
          </Button>
        )}

        <ul className="space-y-3">
          {notes.length === 0 && (
            <li className="font-switzer text-sm text-slate-helper">
              No notes yet
            </li>
          )}
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-2xl border border-ash bg-peach-wash/40 p-3"
            >
              <p className="whitespace-pre-wrap font-switzer text-sm text-portrait-ink">
                {n.note}
              </p>
              <p className="mt-2 text-xs text-slate-helper">
                {n.addedByName || 'Admin'} ·{' '}
                {new Date(n.createdAt).toLocaleString('en-IN', {
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

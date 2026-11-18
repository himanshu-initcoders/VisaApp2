'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import type { ActionResponse } from '@/types/admin';
import type { CommentView } from '@/lib/visa/corrections';

/** ~4 message cards (padding + meta + body + gaps) before the list scrolls. */
const MESSAGE_LIST_MAX_HEIGHT =
  'max-h-[calc(4*5.25rem+3*0.75rem)]';

interface ConversationThreadProps {
  applicationId: string;
  comments: CommentView[];
  postComment: (input: {
    applicationId: string;
    body: string;
  }) => Promise<ActionResponse>;
}

export function ConversationThread({
  applicationId,
  comments,
  postComment,
}: ConversationThreadProps) {
  const router = useRouter();
  const listRef = useRef<HTMLOListElement>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ordered = [...comments].reverse();

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [ordered.length]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!body.trim()) {
      setError('Write a comment first');
      return;
    }
    setSubmitting(true);
    try {
      const result = await postComment({ applicationId, body: body.trim() });
      if (!result.success) {
        setError(result.message || 'Could not post the comment');
        return;
      }
      setBody('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <p className="font-switzer text-sm text-slate-helper">
          No messages yet. Comments here are visible to the applicant and the review team.
        </p>
      ) : (
        <ol
          ref={listRef}
          className={`${MESSAGE_LIST_MAX_HEIGHT} space-y-3 overflow-y-auto overscroll-contain pr-1`}
        >
          {ordered.map((comment) => (
            <li
              key={comment.id}
              className="rounded-2xl border border-ash bg-white px-4 py-3"
            >
              <p className="font-switzer text-xs text-slate-helper">
                <span className="font-semibold text-portrait-ink">
                  {comment.authorName}
                </span>{' '}
                · {comment.authorRole} ·{' '}
                {new Date(comment.createdAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}
              </p>
              <p className="mt-2 whitespace-pre-wrap font-switzer text-sm text-portrait-ink">
                {comment.body}
              </p>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="Write a comment"
          className="w-full rounded-2xl border border-ash px-3 py-2 font-switzer text-sm text-portrait-ink"
        />
        {error && (
          <p className="font-switzer text-sm text-[#ff4940]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send comment'}
        </Button>
      </form>
    </div>
  );
}

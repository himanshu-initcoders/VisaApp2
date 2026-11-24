'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { ActionResponse } from '@/types/admin';
import type { CommentView } from '@/lib/visa/corrections';

/** ~4 message cards (padding + meta + body + gaps) before the list scrolls. */
const MESSAGE_LIST_MAX_HEIGHT =
  'max-h-[calc(4*5.25rem+3*0.75rem)]';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

const MAX_FILE_MB = 10;
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp';

interface ConversationThreadProps {
  applicationId: string;
  comments: CommentView[];
  postComment: (input: {
    applicationId: string;
    body: string;
    file?: {
      filename: string;
      mimeType: string;
      bufferBase64: string;
    };
  }) => Promise<ActionResponse>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

export function ConversationThread({
  applicationId,
  comments,
  postComment,
}: ConversationThreadProps) {
  const router = useRouter();
  const fileInputId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ordered = [...comments].reverse();

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [ordered.length]);

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    const mime = (selected.type || '').toLowerCase();
    if (!(ACCEPTED_TYPES as readonly string[]).includes(mime)) {
      setError('Only PDF, JPG, PNG, or WebP files are allowed');
      clearFile();
      return;
    }
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_FILE_MB}MB`);
      clearFile();
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const trimmed = body.trim();
    if (!trimmed && !file) {
      setError('Write a comment or attach a file');
      return;
    }
    setSubmitting(true);
    try {
      const payload: {
        applicationId: string;
        body: string;
        file?: {
          filename: string;
          mimeType: string;
          bufferBase64: string;
        };
      } = {
        applicationId,
        body: trimmed,
      };
      if (file) {
        payload.file = {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          bufferBase64: await fileToBase64(file),
        };
      }
      const result = await postComment(payload);
      if (!result.success) {
        setError(result.message || 'Could not post the comment');
        return;
      }
      setBody('');
      clearFile();
      router.refresh();
    } catch {
      setError('Could not post the comment');
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
          {ordered.map((comment) => {
            const attachment = comment.attachment;
            const downloadUrl = attachment
              ? `${attachment.url}${attachment.url.includes('?') ? '&' : '?'}download=1`
              : null;

            return (
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
                {comment.body ? (
                  <p className="mt-2 whitespace-pre-wrap font-switzer text-sm text-portrait-ink">
                    {comment.body}
                  </p>
                ) : null}
                {attachment ? (
                  <div className="mt-3 rounded-2xl border border-ash bg-sky-wash/40 p-3">
                    {isImageMime(attachment.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachment.url}
                        alt={attachment.filename}
                        className="mb-2 max-h-48 w-auto max-w-full rounded-xl object-contain"
                      />
                    ) : null}
                    <p className="font-switzer text-sm font-medium text-portrait-ink">
                      {attachment.filename}
                      {attachment.fileSize != null ? (
                        <span className="ml-2 font-normal text-slate-helper">
                          {formatFileSize(attachment.fileSize)}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-switzer text-sm font-medium text-nautical-teal underline-offset-2 hover:underline"
                      >
                        View
                      </a>
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          className="font-switzer text-sm font-medium text-nautical-teal underline-offset-2 hover:underline"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
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

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={handleFileChange}
          />
          <label
            htmlFor={fileInputId}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ash bg-white px-3 py-1.5 font-switzer text-sm text-portrait-ink hover:bg-sky-wash/50"
          >
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
            Attach PDF or image
          </label>
          <span className="font-switzer text-xs text-slate-helper">
            1 file, up to {MAX_FILE_MB}MB
          </span>
        </div>

        {file ? (
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-ash bg-mint-wash/50 px-3 py-1.5">
            <span className="truncate font-switzer text-sm text-portrait-ink">
              {file.name}
              <span className="ml-2 text-slate-helper">
                {formatFileSize(file.size)}
              </span>
            </span>
            <button
              type="button"
              onClick={clearFile}
              className="inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-portrait-ink hover:bg-white"
              aria-label="Remove attachment"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

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

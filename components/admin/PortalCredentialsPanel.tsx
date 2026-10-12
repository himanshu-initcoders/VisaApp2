'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import {
  revealApplicationCredential,
  saveApplicationCredential,
} from '@/app/(admin)/actions';

interface PortalCredentialsPanelProps {
  applicationId: string;
  applicationType: 'visa' | 'passport';
  username: string | null;
  hasCredential: boolean;
}

/**
 * Staff-only portal login. The stored password is never rendered.
 * Copy asks the server to decrypt it, then writes the clipboard.
 */
async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    if (!copied) throw new Error('copy failed');
  }
}

export function PortalCredentialsPanel({
  applicationId,
  applicationType,
  username,
  hasCredential,
}: PortalCredentialsPanelProps) {
  const router = useRouter();
  const [savedUsername, setSavedUsername] = useState(username);
  const [stored, setStored] = useState(hasCredential);
  const [draftUsername, setDraftUsername] = useState(username ?? '');
  const [draftPassword, setDraftPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(
    null
  );
  const [open, setOpen] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isCopying, startCopy] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, isSaving]);

  useEffect(() => {
    setSavedUsername(username);
    setStored(hasCredential);
    setDraftUsername(username ?? '');
  }, [username, hasCredential]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startSave(async () => {
      const result = await saveApplicationCredential({
        applicationId,
        applicationType,
        username: draftUsername,
        password: draftPassword,
      });
      if (!result.success) {
        setError(result.error || result.message);
        return;
      }
      setSavedUsername(draftUsername.trim());
      setStored(true);
      setDraftPassword('');
      setNotice(result.message);
      router.refresh();
    });
  };

  const markCopied = (field: 'username' | 'password') => {
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 2000);
  };

  const handleCopyUsername = async () => {
    if (!savedUsername) return;
    setError(null);
    try {
      await writeClipboard(savedUsername);
      markCopied('username');
    } catch {
      setError('Could not copy to the clipboard');
    }
  };

  const handleCopy = () => {
    setError(null);
    setCopiedField((current) => (current === 'password' ? null : current));
    startCopy(async () => {
      const result = await revealApplicationCredential({
        applicationId,
        applicationType,
      });
      const password = result.data?.password;
      if (!result.success || !password) {
        setError(result.error || result.message);
        return;
      }
      try {
        await writeClipboard(password);
        markCopied('password');
      } catch {
        setError('Could not copy to the clipboard');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 font-switzer text-sm font-semibold text-nautical-teal hover:text-portrait-ink"
      >
        Portal login
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isSaving) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => {
              if (!isSaving) setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-login-title"
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-elevated"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-helper transition-colors hover:bg-sky-wash hover:text-portrait-ink disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
            <h2
              id="portal-login-title"
              className="mb-4 pr-8 font-basier text-[31px] leading-tight text-portrait-ink"
            >
              Portal login
            </h2>
            <div className="space-y-4">
        {stored ? (
          <div className="space-y-3 rounded-2xl border border-ash bg-sky-wash/40 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <p className="mb-1 font-switzer text-xs text-slate-helper">Username</p>
                <p className="break-all font-switzer text-sm text-portrait-ink">
                  {savedUsername}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="inline-flex items-center"
                aria-label="Copy username"
                onClick={handleCopyUsername}
              >
                {copiedField === 'username' ? (
                  <Check className="mr-1.5 h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                )}
                {copiedField === 'username' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <p className="mb-1 font-switzer text-xs text-slate-helper">Password</p>
                <p
                  className="font-switzer text-sm tracking-[0.3em] text-portrait-ink"
                  aria-label="Password hidden"
                >
                  ••••••••
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="inline-flex items-center"
                aria-label="Copy password"
                disabled={isCopying}
                onClick={handleCopy}
              >
                {copiedField === 'password' ? (
                  <Check className="mr-1.5 h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                )}
                {copiedField === 'password' ? 'Copied' : isCopying ? 'Copying…' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="font-switzer text-sm text-slate-helper">
            No portal login saved yet.
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <Input
            label="Username"
            name="username"
            autoComplete="off"
            value={draftUsername}
            onChange={(event) => setDraftUsername(event.target.value)}
            maxLength={255}
          />
          <Input
            label={stored ? 'New password' : 'Password'}
            name="portal-password"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            value={draftPassword}
            onChange={(event) => setDraftPassword(event.target.value)}
            maxLength={500}
            helperText="Saving replaces the stored password."
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-nautical-teal">{notice}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || !draftUsername.trim() || !draftPassword}
            >
              {isSaving ? 'Saving…' : 'Save login'}
            </Button>
          </div>
        </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { updateListingDisclaimer } from '@/app/(admin)/admin/config/visa-listings/actions';

const TinyMceEditor = dynamic(
  () =>
    import('@/components/admin/config/TinyMceEditor').then(
      (mod) => mod.TinyMceEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] animate-pulse rounded-2xl border border-ash-divider bg-sky-wash/40" />
    ),
  }
);

interface DisclaimerEditorProps {
  processId: string;
  initialDisclaimer?: string | null;
}

export function DisclaimerEditor({
  processId,
  initialDisclaimer,
}: DisclaimerEditorProps) {
  const hasTinymceKey = Boolean(process.env.NEXT_PUBLIC_TINYMCE_API_KEY);
  const [html, setHtml] = useState(initialDisclaimer || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setHtml(initialDisclaimer || '');
  }, [initialDisclaimer]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateListingDisclaimer(processId, html);
      if (result.error) {
        alert(result.error);
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert('Failed to save disclaimer');
    } finally {
      setIsSaving(false);
    }
  };

  const hasExisting = Boolean(initialDisclaimer?.trim());

  return (
    <div className="space-y-4 rounded-3xl border border-ash-divider bg-white p-6">
      <div>
        <p className="text-sm text-slate-helper mb-4">
          Shown as a Disclaimer section on the public visa listing page (above
          FAQs and More destinations). Leave empty to hide the section.
        </p>
        {hasTinymceKey ? (
          <TinyMceEditor
            value={html}
            onChange={setHtml}
            height={360}
            disabled={isSaving}
          />
        ) : (
          <textarea
            rows={12}
            className="w-full rounded-2xl border border-ash-divider px-4 py-3 font-mono text-sm text-portrait-ink focus:border-nautical-teal focus:outline-none focus:ring-2 focus:ring-nautical-teal/20"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<p>Important terms and limitations for this visa…</p>"
            disabled={isSaving}
          />
        )}
        {!hasTinymceKey ? (
          <p className="mt-2 text-xs text-slate-helper">
            TinyMCE key missing — editing as HTML.
          </p>
        ) : null}
      </div>

      <Button
        onClick={handleSave}
        variant="primary"
        size="md"
        disabled={isSaving || saveSuccess}
      >
        {saveSuccess ? (
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            Saved!
          </span>
        ) : isSaving ? (
          'Saving...'
        ) : hasExisting ? (
          'Update Disclaimer'
        ) : (
          'Save Disclaimer'
        )}
      </Button>
    </div>
  );
}

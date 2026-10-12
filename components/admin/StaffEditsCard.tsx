import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { StaffFieldEditView } from '@/lib/visa/corrections';

function ValueView({ value }: { value: unknown }) {
  if (value == null || value === '') {
    return <span className="text-slate-helper">—</span>;
  }
  if (typeof value === 'object' && value && 'filename' in value) {
    const file = value as { filename?: string | null; url?: string | null };
    const label = file.filename || 'File';
    if (file.url) {
      return (
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-nautical-teal hover:text-portrait-ink"
        >
          {label}
        </a>
      );
    }
    return <span>{label}</span>;
  }
  if (typeof value === 'string') return <span>{value}</span>;
  return <span>{JSON.stringify(value)}</span>;
}

export function StaffEditsCard({ edits }: { edits: StaffFieldEditView[] }) {
  if (edits.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff edits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {edits.map((edit) => (
          <article
            key={edit.id}
            className="rounded-2xl border border-ash px-3 py-2 font-switzer text-sm"
          >
            <p className="font-semibold text-portrait-ink">
              {edit.travellerName} · {edit.label}
            </p>
            <p className="mt-1 text-slate-helper">
              {edit.actorName} ·{' '}
              {new Date(edit.createdAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}
            </p>
            <p className="mt-1 text-portrait-ink">{edit.message}</p>
            <p className="mt-2 text-portrait-ink">
              <ValueView value={edit.previousValue} />
              <span className="text-slate-helper"> → </span>
              <ValueView value={edit.newValue} />
            </p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

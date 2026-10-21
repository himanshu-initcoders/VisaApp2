import { requireRole } from '@/lib/auth-utils';
import { listDocumentTypes } from '@/lib/db/queries/config';
import { DocumentTypesManager } from '@/components/admin/config/DocumentTypesManager';

/**
 * Document Type Management
 *
 * Admins can add types, rename labels, and upload/replace sample documents.
 * Types cannot be deleted.
 */
export default async function DocumentTypesPage() {
  await requireRole(['admin']);

  const rows = await listDocumentTypes();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1
            className="mb-2 text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
          >
            Document Types
          </h1>
          <p className="text-base text-slate-helper">
            Manage the catalog of document types used in visa listing
            requirements. Upload a sample file applicants can download while
            applying. Types can be renamed but not deleted.
          </p>
        </div>

        <DocumentTypesManager
          initialTypes={rows.map((row) => ({
            id: row.id,
            value: row.value,
            label: row.label,
            sampleDocumentUrl: row.sampleDocumentUrl,
            sampleDocumentFilename: row.sampleDocumentFilename,
            sampleDocumentMimeType: row.sampleDocumentMimeType,
            sortOrder: row.sortOrder,
          }))}
        />
      </div>
    </div>
  );
}

import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/PageHeader';
import { CreateReviewerForm } from '@/components/admin/CreateReviewerForm';

/**
 * Create a reviewer account. Admin only.
 */
export default async function NewReviewerPage() {
  await requireRole(['admin']);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 font-switzer text-sm">
        <Link href="/admin/users" className="text-nautical-teal hover:underline">
          Users
        </Link>
        <span className="text-slate-helper">/</span>
        <span className="text-portrait-ink">Create reviewer</span>
      </div>

      <PageHeader
        title="Create reviewer"
        description="Add a staff account that can review applications"
      />

      <CreateReviewerForm />
    </div>
  );
}

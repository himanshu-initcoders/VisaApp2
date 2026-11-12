import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getApplicationDetails } from '@/lib/admin-queries';
import { PassportCorrectionWizard } from '@/components/apply/passport/PassportCorrectionWizard';
import {
  getOpenPassportCorrection,
  labelForPassportTarget,
} from '@/lib/passport/corrections';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PassportCorrectionPage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect('/signin');

  const { id } = await params;
  const details = await getApplicationDetails(id, 'passport');
  if (!details || details.user.id !== session.user.id) {
    notFound();
  }

  const app = details.application as {
    id: string;
    referenceNumber?: string | null;
    status: string;
    formSnapshot?: PassportApplyFormConfig | null;
    answers?: Record<string, unknown> | null;
  };

  const open = await getOpenPassportCorrection(app.id);
  if (!open) {
    redirect(`/applications/passport/${app.referenceNumber || app.id}`);
  }

  const snapshot = (app.formSnapshot as PassportApplyFormConfig | null) ?? {
    serviceType: 'fresh',
    productName: 'Passport',
    description: null,
    steps: [],
    documentSlots: [],
  };

  const items = open.items
    .filter((item) => item.status === 'open')
    .map((item) => ({
      targetKey: item.targetKey,
      label: labelForPassportTarget(snapshot, item.targetKey),
      comment: item.comment,
      kind: item.kind,
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href={`/applications/passport/${app.referenceNumber || app.id}`}
        className="inline-flex items-center font-switzer text-sm text-nautical-teal transition-colors hover:text-portrait-ink"
      >
        ← Back to application
      </Link>
      <PassportCorrectionWizard
        applicationId={app.id}
        productName={snapshot.productName || 'Passport'}
        formConfig={snapshot}
        answers={
          app.answers && typeof app.answers === 'object' ? app.answers : {}
        }
        items={items}
      />
    </div>
  );
}

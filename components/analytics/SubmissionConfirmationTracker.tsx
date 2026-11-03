'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics/gtm';

/** Fires once when dashboard shows a post-submit confirmation banner. */
export function SubmissionConfirmationTracker({
  applicationId,
}: {
  applicationId: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (!applicationId || fired.current) return;
    fired.current = true;
    trackEvent('visa_submission_confirmation_view', {
      application_id: applicationId,
    });
  }, [applicationId]);

  return null;
}

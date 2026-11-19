'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { ApplicantAuthPanel } from '@/components/auth/ApplicantAuthPanel';

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  return (
    <ApplicantAuthPanel
      variant="page"
      redirectTo={callbackUrl}
      analyticsContext="signin"
    />
  );
}

export default function SignInPage() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="font-basier text-2xl">
          Sign{' '}
          <span className="italic bg-gradient-rainbow bg-clip-text text-transparent">
            in
          </span>
        </CardTitle>
        <CardDescription>
          Enter your mobile number. We will send a one-time code on WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p className="text-sm text-slate-helper">Loading…</p>}>
          <SignInForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}

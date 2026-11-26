import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata({
  title: 'Sign in with WhatsApp',
  description:
    'Sign in to your Viserv account with your mobile number. We send a one-time code on WhatsApp. This page is not indexed.',
  path: '/signin',
});

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
